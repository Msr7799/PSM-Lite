import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONVERSATIONS = 100;

// GET - List all conversations
export async function GET() {
    try {
        const conversations = await prisma.simsarConversation.findMany({
            orderBy: { updatedAt: 'desc' },
            take: MAX_CONVERSATIONS,
            select: {
                id: true,
                title: true,
                modelId: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { messages: true } },
            },
        });

        return NextResponse.json({ conversations });
    } catch (error) {
        console.error('Conversations list error:', error);
        return NextResponse.json(
            { error: 'فشل في تحميل المحادثات' },
            { status: 500 }
        );
    }
}

// POST - Create a new conversation
export async function POST(request: NextRequest) {
    try {
        const { title, modelId } = await request.json();

        // Enforce limit: delete oldest if at max
        const count = await prisma.simsarConversation.count();
        if (count >= MAX_CONVERSATIONS) {
            const oldest = await prisma.simsarConversation.findMany({
                orderBy: { updatedAt: 'asc' },
                take: count - MAX_CONVERSATIONS + 1,
                select: { id: true },
            });
            if (oldest.length > 0) {
                await prisma.simsarConversation.deleteMany({
                    where: { id: { in: oldest.map(c => c.id) } },
                });
            }
        }

        const conversation = await prisma.simsarConversation.create({
            data: {
                title: title || null,
                modelId: modelId || null,
            },
        });

        return NextResponse.json({ conversation });
    } catch (error) {
        console.error('Create conversation error:', error);
        return NextResponse.json(
            { error: 'فشل في إنشاء المحادثة' },
            { status: 500 }
        );
    }
}

// DELETE - Delete all conversations
export async function DELETE() {
    try {
        await prisma.simsarConversation.deleteMany();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete all conversations error:', error);
        return NextResponse.json(
            { error: 'فشل في حذف المحادثات' },
            { status: 500 }
        );
    }
}
