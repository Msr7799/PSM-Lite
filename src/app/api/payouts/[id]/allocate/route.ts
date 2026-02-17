import { prisma } from "@/lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";
import { z } from "zod";

const Body = z.object({
  lines: z.array(
    z.object({
      bookingId: z.string().optional().nullable(),
      amount: z.union([z.string(), z.number()]),
      note: z.string().optional().nullable(),
    })
  ),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) return new Response("Payout not found", { status: 404 });

  const created = await prisma.$transaction(async (tx) => {
    const lines = [];
    for (const l of parsed.data.lines) {
      const row = await tx.payoutLine.create({
        data: {
          payoutId: id,
          bookingId: l.bookingId ?? null,
          amount: new Prisma.Decimal(String(l.amount)),
          note: l.note ?? null,
        },
      });
      lines.push(row);

      // Update booking payment status if linked
      if (l.bookingId) {
        const b = await tx.booking.findUnique({ where: { id: l.bookingId } });
        if (b?.netAmount) {
          const net = b.netAmount;
          const paidSoFarAgg = await tx.payoutLine.aggregate({
            where: { bookingId: l.bookingId },
            _sum: { amount: true },
          });
          const paidSoFar = paidSoFarAgg._sum.amount ?? new Prisma.Decimal(0);

          let status: PaymentStatus = PaymentStatus.UNPAID;
          if (paidSoFar.greaterThanOrEqualTo(net)) status = PaymentStatus.PAID;
          else if (paidSoFar.greaterThan(0)) status = PaymentStatus.PARTIAL;

          await tx.booking.update({ where: { id: l.bookingId }, data: { paymentStatus: status } });
        }
      }
    }
    return lines;
  });

  return Response.json({ created: created.length });
}
