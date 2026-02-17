import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma } from "@prisma/client";

const decOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  return new Prisma.Decimal(String(v));
};

const isValidEnum = <T extends Record<string, string>>(e: T, v: any): v is T[keyof T] =>
  Object.values(e).includes(v);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  const body = await req.json();

  const currency = body.currency ? String(body.currency) : undefined;
  const grossAmount = decOrNull(body.grossAmount);
  const commissionAmount = decOrNull(body.commissionAmount);
  const taxAmount = decOrNull(body.taxAmount);
  const otherFeesAmount = decOrNull(body.otherFeesAmount);

  // If net not provided, compute when any inputs exist
  const netAmountInput = decOrNull(body.netAmount);
  const hasAny = grossAmount || commissionAmount || taxAmount || otherFeesAmount;

  const g = grossAmount ?? new Prisma.Decimal(0);
  const c = commissionAmount ?? new Prisma.Decimal(0);
  const t = taxAmount ?? new Prisma.Decimal(0);
  const f = otherFeesAmount ?? new Prisma.Decimal(0);

  const netAmount = netAmountInput ?? (hasAny ? g.minus(c).minus(t).minus(f) : null);

  const paymentStatus = isValidEnum(PaymentStatus, body.paymentStatus)
    ? body.paymentStatus
    : undefined;

  const notes = body.notes !== undefined ? String(body.notes) : undefined;

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      ...(currency ? { currency } : {}),
      grossAmount,
      commissionAmount,
      taxAmount,
      otherFeesAmount,
      netAmount,
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
  });

  return Response.json({
    booking: {
      id: updated.id,
      grossAmount: updated.grossAmount?.toString() ?? null,
      commissionAmount: updated.commissionAmount?.toString() ?? null,
      taxAmount: updated.taxAmount?.toString() ?? null,
      otherFeesAmount: updated.otherFeesAmount?.toString() ?? null,
      netAmount: updated.netAmount?.toString() ?? null,
      paymentStatus: updated.paymentStatus,
      notes: updated.notes,
    },
  });
}
