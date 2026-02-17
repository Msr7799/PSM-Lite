import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) return new Response("from & to required", { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const revenueAgg = await prisma.booking.aggregate({
    _sum: {
      netAmount: true,
      grossAmount: true,
      commissionAmount: true,
      taxAmount: true,
      otherFeesAmount: true,
    },
    where: {
      startDate: { gte: fromDate, lt: toDate },
    },
  });

  const expenseAgg = await prisma.expense.aggregate({
    _sum: { amount: true },
    where: { spentAt: { gte: fromDate, lt: toDate } },
  });

  const gross = Number(revenueAgg._sum.grossAmount ?? 0);
  const commission = Number(revenueAgg._sum.commissionAmount ?? 0);
  const taxes = Number(revenueAgg._sum.taxAmount ?? 0);
  const fees = Number(revenueAgg._sum.otherFeesAmount ?? 0);
  const net = Number(revenueAgg._sum.netAmount ?? 0);

  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const profit = net - expenses;

  const f3 = (n: number) => n.toFixed(3);

  return Response.json({
    from,
    to,
    currency: "BHD",
    revenue: {
      gross: f3(gross),
      commission: f3(commission),
      taxes: f3(taxes),
      fees: f3(fees),
      net: f3(net),
    },
    expenses: f3(expenses),
    profit: f3(profit),
  });
}
