import { prisma } from '@/lib/prisma';

export interface PropertyContext {
  units: UnitSummary[];
  bookings: BookingSummary[];
  expenses: ExpenseSummary[];
  stats: SystemStats;
  timestamp: string;
}

interface UnitSummary {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  currency: string;
  defaultRate: number | null;
  bookingsCount: number;
  upcomingBookings: number;
  content: {
    title: string | null;
    address: string | null;
    guestCapacity: string | null;
  } | null;
}

interface BookingSummary {
  id: string;
  unitName: string;
  channel: string;
  startDate: string;
  endDate: string;
  summary: string | null;
  grossAmount: number | null;
  netAmount: number | null;
  paymentStatus: string;
  isCancelled: boolean;
}

interface ExpenseSummary {
  id: string;
  unitName: string;
  category: string;
  amount: number;
  currency: string;
  spentAt: string;
  note: string | null;
}

interface SystemStats {
  totalUnits: number;
  activeUnits: number;
  totalBookings: number;
  upcomingBookings: number;
  currentBookings: number;
  totalRevenue: number;
  totalExpenses: number;
  occupancyRate: number;
}

export async function getPropertyContext(): Promise<PropertyContext> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Fetch all units with their content
  const units = await prisma.unit.findMany({
    include: {
      content: true,
      bookings: {
        where: {
          isCancelled: false,
          endDate: { gte: thirtyDaysAgo },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Fetch recent and upcoming bookings
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { startDate: { gte: thirtyDaysAgo, lte: thirtyDaysFromNow } },
        { endDate: { gte: thirtyDaysAgo, lte: thirtyDaysFromNow } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    },
    include: {
      unit: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 100,
  });

  // Fetch recent expenses
  const expenses = await prisma.expense.findMany({
    where: {
      spentAt: { gte: thirtyDaysAgo },
    },
    include: {
      unit: { select: { name: true } },
    },
    orderBy: { spentAt: 'desc' },
    take: 50,
  });

  // Calculate stats
  const totalRevenue = bookings
    .filter(b => !b.isCancelled)
    .reduce((sum, b) => sum + (b.netAmount?.toNumber() || 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount.toNumber(), 0);

  const currentBookings = bookings.filter(
    b => !b.isCancelled && b.startDate <= now && b.endDate >= now
  ).length;

  const upcomingBookings = bookings.filter(
    b => !b.isCancelled && b.startDate > now
  ).length;

  // Format data for AI context
  const unitSummaries: UnitSummary[] = units.map(unit => ({
    id: unit.id,
    name: unit.name,
    code: unit.code,
    isActive: unit.isActive,
    currency: unit.currency,
    defaultRate: unit.defaultRate?.toNumber() || null,
    bookingsCount: unit.bookings.length,
    upcomingBookings: unit.bookings.filter(b => b.startDate > now).length,
    content: unit.content ? {
      title: unit.content.title,
      address: unit.content.address,
      guestCapacity: unit.content.guestCapacity,
    } : null,
  }));

  const bookingSummaries: BookingSummary[] = bookings.map(booking => ({
    id: booking.id,
    unitName: booking.unit.name,
    channel: booking.channel,
    startDate: booking.startDate.toISOString().split('T')[0],
    endDate: booking.endDate.toISOString().split('T')[0],
    summary: booking.summary,
    grossAmount: booking.grossAmount?.toNumber() || null,
    netAmount: booking.netAmount?.toNumber() || null,
    paymentStatus: booking.paymentStatus,
    isCancelled: booking.isCancelled,
  }));

  const expenseSummaries: ExpenseSummary[] = expenses.map(expense => ({
    id: expense.id,
    unitName: expense.unit.name,
    category: expense.category,
    amount: expense.amount.toNumber(),
    currency: expense.currency,
    spentAt: expense.spentAt.toISOString().split('T')[0],
    note: expense.note,
  }));

  const stats: SystemStats = {
    totalUnits: units.length,
    activeUnits: units.filter(u => u.isActive).length,
    totalBookings: bookings.length,
    upcomingBookings,
    currentBookings,
    totalRevenue,
    totalExpenses,
    occupancyRate: units.length > 0 ? (currentBookings / units.filter(u => u.isActive).length) * 100 : 0,
  };

  return {
    units: unitSummaries,
    bookings: bookingSummaries,
    expenses: expenseSummaries,
    stats,
    timestamp: now.toISOString(),
  };
}

export function formatContextForAI(context: PropertyContext): string {
  const { units, bookings, expenses, stats, timestamp } = context;

  let contextText = `📊 **بيانات النظام** (آخر تحديث: ${new Date(timestamp).toLocaleString('ar-SA')})\n\n`;

  // Stats
  contextText += `## الإحصائيات العامة:\n`;
  contextText += `- إجمالي الوحدات: ${stats.totalUnits} (${stats.activeUnits} نشطة)\n`;
  contextText += `- الحجوزات الحالية: ${stats.currentBookings}\n`;
  contextText += `- الحجوزات القادمة: ${stats.upcomingBookings}\n`;
  contextText += `- إجمالي الإيرادات (30 يوم): ${stats.totalRevenue.toFixed(3)} BHD\n`;
  contextText += `- إجمالي المصروفات (30 يوم): ${stats.totalExpenses.toFixed(3)} BHD\n`;
  contextText += `- نسبة الإشغال: ${stats.occupancyRate.toFixed(1)}%\n\n`;

  // Units
  contextText += `## الوحدات العقارية:\n`;
  units.forEach(unit => {
    contextText += `- **${unit.name}** (${unit.code || 'بدون رمز'}): `;
    contextText += unit.isActive ? '✅ نشطة' : '❌ غير نشطة';
    if (unit.defaultRate) contextText += ` | السعر: ${unit.defaultRate} ${unit.currency}`;
    if (unit.content?.address) contextText += ` | العنوان: ${unit.content.address}`;
    if (unit.content?.guestCapacity) contextText += ` | السعة: ${unit.content.guestCapacity}`;
    contextText += ` | الحجوزات: ${unit.bookingsCount}\n`;
  });

  // Recent & Upcoming Bookings
  contextText += `\n## الحجوزات (آخر 30 يوم والقادمة):\n`;
  bookings.slice(0, 20).forEach(booking => {
    const status = booking.isCancelled ? '❌ ملغي' : 
      booking.paymentStatus === 'PAID' ? '✅ مدفوع' :
      booking.paymentStatus === 'PARTIAL' ? '⚠️ جزئي' : '⏳ غير مدفوع';
    contextText += `- ${booking.unitName}: ${booking.startDate} → ${booking.endDate} | ${booking.channel} | ${status}`;
    if (booking.netAmount) contextText += ` | ${booking.netAmount} BHD`;
    contextText += `\n`;
  });

  // Recent Expenses
  if (expenses.length > 0) {
    contextText += `\n## المصروفات الأخيرة:\n`;
    expenses.slice(0, 10).forEach(expense => {
      contextText += `- ${expense.unitName}: ${expense.amount} ${expense.currency} | ${expense.category} | ${expense.spentAt}`;
      if (expense.note) contextText += ` | ${expense.note}`;
      contextText += `\n`;
    });
  }

  return contextText;
}
