import { prisma } from "@/lib/prisma";
import { ExpenseCategory, Prisma } from "@prisma/client";

const dec = (v: any) => new Prisma.Decimal(String(v));

const isValidCategory = (v: any): v is ExpenseCategory =>
  Object.values(ExpenseCategory).includes(v);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const unitId = url.searchParams.get("unitId");

  if (!from || !to) return new Response("from & to required", { status: 400 });

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const expenses = await prisma.expense.findMany({
    where: {
      ...(unitId ? { unitId } : {}),
      spentAt: { gte: fromDate, lt: toDate },
    },
    include: { unit: { select: { name: true } } },
    orderBy: [{ spentAt: "desc" }],
  });

  return Response.json({
    expenses: expenses.map((e) => ({
      id: e.id,
      unitId: e.unitId,
      unitName: e.unit.name,
      category: e.category,
      amount: e.amount.toString(),
      currency: e.currency,
      spentAt: e.spentAt.toISOString(),
      note: e.note,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const unitId = String(body.unitId ?? "");
  const amountRaw = body.amount;
  const spentAt = new Date(String(body.spentAt ?? ""));

  if (!unitId) return new Response("unitId required", { status: 400 });
  if (amountRaw === null || amountRaw === undefined || amountRaw === "") {
    return new Response("amount required", { status: 400 });
  }
  if (Number.isNaN(spentAt.valueOf())) return new Response("Invalid spentAt", { status: 400 });

  const category = isValidCategory(body.category) ? body.category : ExpenseCategory.OTHER;

  const created = await prisma.expense.create({
    data: {
      unitId,
      category,
      amount: dec(amountRaw),
      currency: body.currency ? String(body.currency) : "BHD",
      spentAt,
      note: body.note ? String(body.note) : null,
    },
  });

  return Response.json({ id: created.id });
}
