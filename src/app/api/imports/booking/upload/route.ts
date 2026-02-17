import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File too large. Max 10MB allowed." },
                { status: 413 }
            );
        }

        const name = file.name.toLowerCase();
        if (
            !name.endsWith(".xls") &&
            !name.endsWith(".xlsx") &&
            !name.endsWith(".csv")
        ) {
            return NextResponse.json(
                { error: "Only .xls, .xlsx, .csv files allowed." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const sheetNames = workbook.SheetNames;
        const defaultSheet = sheetNames[0];
        const selectedSheet = (formData.get("sheet") as string) || defaultSheet;

        const sheet = workbook.Sheets[selectedSheet];
        if (!sheet) {
            return NextResponse.json(
                { error: `Sheet "${selectedSheet}" not found.` },
                { status: 400 }
            );
        }

        const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
            sheet,
            { defval: "" }
        );

        // Get headers from first row keys
        const headers: string[] =
            jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

        // Preview first 50 rows
        const preview = jsonData.slice(0, 50).map((row) => {
            const safeRow: Record<string, string> = {};
            for (const key of headers) {
                const val = row[key];
                safeRow[key] = val === null || val === undefined ? "" : String(val);
            }
            return safeRow;
        });

        return NextResponse.json({
            sheetNames,
            selectedSheet,
            headers,
            totalRows: jsonData.length,
            preview,
        });
    } catch (err: unknown) {
        console.error("[upload] error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
