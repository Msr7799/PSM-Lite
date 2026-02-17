import { prisma } from "@/lib/prisma";

export async function GET() {
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, name: true, content: { select: { updatedAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      hasContent: Boolean(u.content),
      updatedAt: u.content?.updatedAt ? u.content.updatedAt.toISOString() : null,
    })),
  });
}
