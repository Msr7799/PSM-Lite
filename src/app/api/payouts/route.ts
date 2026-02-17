import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const Body = z.object({
  channel: z.enum(["BOOKING","AIRBNB","AGODA","MANUAL","OTHER"]),
  payoutDate: z.string().min(1),
  currency: z.string().min(1).optional(),
  amount: z.union([z.string(), z.number()]),
  providerRef: z.string().optional(),
  status: z.enum(["PENDING","RECEIVED"]).optional(),
  note: z.string().optional(),
});

export async function GET() {
  const payouts = await prisma.payout.findMany({
    orderBy: { payoutDate: "desc" },
    include: {
      lines: {
        include: { booking: { include: { unit: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
    take: 50,
  });

  return Response.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      channel: p.channel,
      payoutDate: p.payoutDate.toISOString().slice(0, 10),
      currency: p.currency,
      amount: p.amount.toString(),
      providerRef: p.providerRef,
      status: p.status,
      note: p.note,
      lines: p.lines.map((l) => ({
        id: l.id,
        bookingId: l.bookingId,
        amount: l.amount.toString(),
        note: l.note,
        booking: l.booking
          ? {
              id: l.booking.id,
              unitName: l.booking.unit.name,
              startDate: l.booking.startDate.toISOString().slice(0, 10),
              endDate: l.booking.endDate.toISOString().slice(0, 10),
              netAmount: l.booking.netAmount?.toString() ?? null,
              paymentStatus: l.booking.paymentStatus,
            }
          : null,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const d = new Date(parsed.data.payoutDate);
  if (Number.isNaN(d.valueOf())) return new Response("Invalid payoutDate", { status: 400 });

  const created = await prisma.payout.create({
    data: {
      channel: parsed.data.channel as any,
      payoutDate: d,
      currency: parsed.data.currency ?? "BHD",
      amount: new Prisma.Decimal(String(parsed.data.amount)),
      providerRef: parsed.data.providerRef ?? null,
      status: (parsed.data.status ?? "RECEIVED") as any,
      note: parsed.data.note ?? null,
    },
  });

  return Response.json({ id: created.id });
}
