import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/simsar/file-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Max 10MB
const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    'txt', 'md', 'csv', 'json',
    'xlsx', 'xls',
    'pdf',
    'docx',
    'jpg', 'jpeg', 'png', 'gif', 'webp',
];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });
        }

        // Validate extension
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: `نوع الملف غير مدعوم: .${ext}. الأنواع المسموحة: ${ALLOWED_EXTENSIONS.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate size
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: `الملف كبير جداً. الحد الأقصى ${MAX_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parsed = await parseFile(buffer, file.name, file.type);

        // For images, also return base64 for multimodal models
        let imageBase64: string | undefined;
        if (file.type.startsWith('image/')) {
            imageBase64 = `data:${file.type};base64,${buffer.toString('base64')}`;
        }

        return NextResponse.json({
            success: true,
            attachment: {
                filename: parsed.filename,
                type: parsed.type,
                size: parsed.size,
                extractedText: parsed.extractedText,
                ...(imageBase64 ? { imageBase64 } : {}),
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'حدث خطأ في رفع الملف' },
            { status: 500 }
        );
    }
}
