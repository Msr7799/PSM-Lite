// Simsar File Parser - Extracts text content from various file types

export interface ParsedFile {
    filename: string;
    type: string;
    size: number;
    extractedText: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 50000; // Max chars to include in context

const SUPPORTED_TYPES: Record<string, string[]> = {
    text: ['text/plain', 'text/markdown', 'text/csv'],
    json: ['application/json'],
    excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    pdf: ['application/pdf'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

export function getSupportedMimeTypes(): string[] {
    return Object.values(SUPPORTED_TYPES).flat();
}

export function getFileCategory(mimeType: string): string {
    for (const [cat, types] of Object.entries(SUPPORTED_TYPES)) {
        if (types.includes(mimeType)) return cat;
    }
    // Fallback: check extensions
    return 'unknown';
}

export function getCategoryFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const extMap: Record<string, string> = {
        txt: 'text', md: 'text', csv: 'text',
        json: 'json',
        xlsx: 'excel', xls: 'excel',
        pdf: 'pdf',
        docx: 'docx',
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    };
    return extMap[ext] || 'unknown';
}

export async function parseFile(buffer: Buffer, filename: string, mimeType: string): Promise<ParsedFile> {
    if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`الملف كبير جداً. الحد الأقصى ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const category = getFileCategory(mimeType) === 'unknown'
        ? getCategoryFromExtension(filename)
        : getFileCategory(mimeType);

    let extractedText = '';

    try {
        switch (category) {
            case 'text':
                extractedText = buffer.toString('utf-8');
                break;

            case 'json':
                const jsonContent = buffer.toString('utf-8');
                // Pretty-print for better readability
                try {
                    const parsed = JSON.parse(jsonContent);
                    extractedText = JSON.stringify(parsed, null, 2);
                } catch {
                    extractedText = jsonContent;
                }
                break;

            case 'csv':
                extractedText = buffer.toString('utf-8');
                break;

            case 'excel':
                extractedText = await parseExcel(buffer);
                break;

            case 'pdf':
                extractedText = await parsePdf(buffer);
                break;

            case 'docx':
                extractedText = await parseDocx(buffer);
                break;

            case 'image':
                extractedText = `[صورة مرفقة: ${filename}]`;
                break;

            default:
                extractedText = `[ملف غير مدعوم: ${filename} (${mimeType})]`;
        }
    } catch (error) {
        console.error(`Error parsing file ${filename}:`, error);
        extractedText = `[خطأ في قراءة الملف: ${filename}]`;
    }

    // Truncate if too long
    if (extractedText.length > MAX_TEXT_LENGTH) {
        extractedText = extractedText.slice(0, MAX_TEXT_LENGTH) + '\n\n... [تم اقتطاع النص - الملف كبير جداً]';
    }

    return {
        filename,
        type: mimeType || category,
        size: buffer.length,
        extractedText,
    };
}

async function parseExcel(buffer: Buffer): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        text += `\n📋 ورقة: ${sheetName}\n`;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        text += csv + '\n';
    }

    return text.trim();
}

async function parsePdf(buffer: Buffer): Promise<string> {
    try {
        // pdf-parse dynamic import
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
        const data = await pdfParse(buffer);
        return data.text || '[ملف PDF فارغ]';
    } catch (error) {
        console.error('PDF parse error:', error);
        return '[خطأ في قراءة ملف PDF]';
    }
}

async function parseDocx(buffer: Buffer): Promise<string> {
    try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '[ملف Word فارغ]';
    } catch (error) {
        console.error('DOCX parse error:', error);
        return '[خطأ في قراءة ملف Word]';
    }
}

// Convert image to base64 data URL for multimodal models
export function imageToBase64(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
