import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Get conversation with messages
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const conversation = await prisma.simsarConversation.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!conversation) {
            return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
        }

        return NextResponse.json({ conversation });
    } catch (error) {
        console.error('Get conversation error:', error);
        return NextResponse.json(
            { error: 'فشل في تحميل المحادثة' },
            { status: 500 }
        );
    }
}

// PATCH - Update conversation title
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { title } = await request.json();

        const conversation = await prisma.simsarConversation.update({
            where: { id },
            data: { title },
        });

        return NextResponse.json({ conversation });
    } catch (error) {
        console.error('Update conversation error:', error);
        return NextResponse.json(
            { error: 'فشل في تحديث المحادثة' },
            { status: 500 }
        );
    }
}

// DELETE - Delete single conversation
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.simsarConversation.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete conversation error:', error);
        return NextResponse.json(
            { error: 'فشل في حذف المحادثة' },
            { status: 500 }
        );
    }
}
