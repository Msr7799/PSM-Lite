import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({
  unitId: z.string().min(1),
  channel: z.enum(["BOOKING", "AIRBNB", "AGODA", "MANUAL", "OTHER"]),
  section: z.string().min(1),
  checksum: z.string().min(16),
  snapshot: z.any(),
  note: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId") ?? "";
  const channel = url.searchParams.get("channel") ?? "";
  const section = url.searchParams.get("section") ?? "";

  if (!unitId) return new Response("unitId required", { status: 400 });

  const where: any = { unitId };
  if (channel) where.channel = channel;
  if (section) where.section = section;

  const items = await prisma.publishSnapshot.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return Response.json({
    items: items.map((x) => ({
      id: x.id,
      unitId: x.unitId,
      channel: x.channel,
      section: x.section,
      checksum: x.checksum,
      publishedAt: x.publishedAt.toISOString(),
      note: x.note,
    })),
  });
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const created = await prisma.publishSnapshot.create({
    data: {
      unitId: parsed.data.unitId,
      channel: parsed.data.channel as any,
      section: parsed.data.section,
      checksum: parsed.data.checksum,
      snapshot: parsed.data.snapshot,
      note: parsed.data.note ?? null,
    },
  });

  return Response.json({ id: created.id });
}
