import { prisma } from "@/lib/prisma";
import { Channel, PaymentStatus, Prisma } from "@prisma/client";

const decOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  return new Prisma.Decimal(String(v));
};

const isValidEnum = <T extends Record<string, string>>(e: T, v: any): v is T[keyof T] =>
  Object.values(e).includes(v);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const unitId = url.searchParams.get("unitId");

  if (!from || !to) return new Response("from & to required", { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf())) {
    return new Response("Invalid date", { status: 400 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      ...(unitId ? { unitId } : {}),
      startDate: { lt: toDate },
      endDate: { gt: fromDate },
    },
    include: { unit: { select: { name: true } } },
    orderBy: [{ startDate: "asc" }],
  });

  return Response.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      unitId: b.unitId,
      unitName: b.unit.name,
      channel: b.channel,
      externalUid: b.externalUid,
      summary: b.summary,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      currency: b.currency,
      grossAmount: b.grossAmount?.toString() ?? null,
      commissionAmount: b.commissionAmount?.toString() ?? null,
      taxAmount: b.taxAmount?.toString() ?? null,
      otherFeesAmount: b.otherFeesAmount?.toString() ?? null,
      netAmount: b.netAmount?.toString() ?? null,
      paymentStatus: b.paymentStatus,
      notes: b.notes,
    })),
  });
}

// Optional: create a manual booking (not required for iCal flow)
export async function POST(req: Request) {
  const body = await req.json();

  const unitId = String(body.unitId ?? "");
  const startDate = new Date(String(body.startDate ?? ""));
  const endDate = new Date(String(body.endDate ?? ""));

  if (!unitId) return new Response("unitId required", { status: 400 });
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    return new Response("Invalid dates", { status: 400 });
  }

  const grossAmount = decOrNull(body.grossAmount);
  const commissionAmount = decOrNull(body.commissionAmount);
  const taxAmount = decOrNull(body.taxAmount);
  const otherFeesAmount = decOrNull(body.otherFeesAmount);
  const netAmountInput = decOrNull(body.netAmount);

  // Compute net if not provided
  const g = grossAmount ?? new Prisma.Decimal(0);
  const c = commissionAmount ?? new Prisma.Decimal(0);
  const t = taxAmount ?? new Prisma.Decimal(0);
  const f = otherFeesAmount ?? new Prisma.Decimal(0);

  let netAmount = netAmountInput;
  if (!netAmount && (grossAmount || commissionAmount || taxAmount || otherFeesAmount)) {
    netAmount = g.minus(c).minus(t).minus(f);
  }

  const paymentStatus = isValidEnum(PaymentStatus, body.paymentStatus)
    ? body.paymentStatus
    : PaymentStatus.UNPAID;

  const created = await prisma.booking.create({
    data: {
      unitId,
      channel: Channel.MANUAL,
      externalUid: `manual:${crypto.randomUUID()}`,
      summary: body.summary ? String(body.summary) : null,
      startDate,
      endDate,
      currency: body.currency ? String(body.currency) : "BHD",
      grossAmount,
      commissionAmount,
      taxAmount,
      otherFeesAmount,
      netAmount,
      paymentStatus,
      notes: body.notes ? String(body.notes) : null,
    },
  });

  return Response.json({ id: created.id });
}
