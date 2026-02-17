"use client";

import { useState, useRef, useCallback } from "react";
import { Link } from "@/i18n/routing";

type Step = "upload" | "mapping" | "result";

type UploadResult = {
    sheetNames: string[];
    selectedSheet: string;
    headers: string[];
    totalRows: number;
    preview: Record<string, string>[];
};

type ImportResult = {
    created: number;
    updated: number;
    errors: string[];
};

const REQUIRED_FIELDS = [
    { key: "bookingPropertyId", label: "Booking Property ID (رقم العقار)", required: true },
    { key: "propertyName", label: "Property Name (اسم العقار)", required: true },
    { key: "locationText", label: "Location (الموقع)", required: false },
    { key: "statusText", label: "Status (الحالة)", required: false },
    { key: "checkins48h", label: "Check-ins 48h", required: false },
    { key: "checkouts48h", label: "Check-outs 48h", required: false },
    { key: "guestMessagesCount", label: "Guest Messages", required: false },
    { key: "bookingMessagesCount", label: "Booking Messages", required: false },
];

export default function ImportClient() {
    const [step, setStep] = useState<Step>("upload");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadData, setUploadData] = useState<UploadResult | null>(null);
    const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // ─── Step 1: Upload ─────────────────────────────
    const handleUpload = useCallback(async () => {
        const file = fileRef.current?.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/imports/booking/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Upload failed");

            setUploadData(data);
            setAllRows(data.preview); // We'll use the full data for import

            // Auto-detect mapping from headers
            const autoMap: Record<string, string> = {};
            const headers = data.headers as string[];
            for (const field of REQUIRED_FIELDS) {
                // Try exact match first
                const exact = headers.find(
                    (h) => h.toLowerCase().replace(/\s+/g, "") === field.key.toLowerCase()
                );
                if (exact) {
                    autoMap[field.key] = exact;
                    continue;
                }
                // Try partial match
                const partial = headers.find((h) => {
                    const hl = h.toLowerCase();
                    if (field.key === "bookingPropertyId") return hl.includes("id") && !hl.includes("message");
                    if (field.key === "propertyName") return hl.includes("property") && !hl.includes("id");
                    if (field.key === "locationText") return hl.includes("location") || hl.includes("address");
                    if (field.key === "statusText") return hl.includes("status");
                    if (field.key === "checkins48h") return hl.includes("arrival") || hl.includes("checkin") || hl.includes("check-in");
                    if (field.key === "checkouts48h") return hl.includes("departure") || hl.includes("checkout") || hl.includes("check-out");
                    if (field.key === "guestMessagesCount") return hl.includes("guest") && hl.includes("message");
                    if (field.key === "bookingMessagesCount") return hl.includes("booking") && hl.includes("message");
                    return false;
                });
                if (partial) autoMap[field.key] = partial;
            }
            setMapping(autoMap);
            setStep("mapping");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Step 2: Import ─────────────────────────────
    const handleImport = useCallback(async () => {
        if (!mapping.bookingPropertyId || !mapping.propertyName) {
            setError("Please map the required fields: Property ID and Property Name");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/imports/booking/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: allRows, mapping }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Import failed");

            setImportResult(data.results);
            setStep("result");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [allRows, mapping]);

    // ─── Render ─────────────────────────────
    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                    ❌ {error}
                </div>
            )}

            {/* ── Step 1: Upload ── */}
            {step === "upload" && (
                <div className="rounded-2xl border  p-5 shadow-sm border-slate-700 bg-slate-900/80">
                    <h2 className="mb-3 text-base font-semibold">
                        📤 Step 1: Upload Excel / CSV
                    </h2>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <label className="mb-1 block text-sm font-medium text-slate-600 ">
                                Select file (.xls, .xlsx, .csv) — Max 10MB
                            </label>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xls,.xlsx,.csv"
                                className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:file:bg-slate-700 dark:file:text-slate-200 dark:hover:file:bg-slate-600"
                            />
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={loading}
                            className="min-h-[46px] h-auto rounded-xl bg-blue-600 px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 cursor-pointer disabled:opacity-50 sm:w-auto"
                        >
                            {loading ? "Processing..." : "Upload & Preview"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Mapping ── */}
            {step === "mapping" && uploadData && (
                <>
                    {/* Preview Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                        <h2 className="mb-2 text-base font-semibold">
                            📋 Preview ({uploadData.totalRows} rows, showing first{" "}
                            {uploadData.preview.length})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        {uploadData.headers.map((h) => (
                                            <th
                                                key={h}
                                                className="px-2 py-1 text-left font-medium text-slate-500"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {uploadData.preview.slice(0, 10).map((row, i) => (
                                        <tr
                                            key={i}
                                            className="border-b border-slate-100 dark:border-slate-800"
                                        >
                                            {uploadData.headers.map((h) => (
                                                <td key={h} className="px-2 py-1 whitespace-nowrap">
                                                    {String(row[h] ?? "").slice(0, 60)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Column Mapping */}
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                        <h2 className="mb-3 text-base font-semibold">
                            🔗 Step 2: Map Columns
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {REQUIRED_FIELDS.map((field) => (
                                <div key={field.key}>
                                    <label className="mb-1 block text-sm font-medium">
                                        {field.label}
                                        {field.required && (
                                            <span className="text-red-500 ms-1">*</span>
                                        )}
                                    </label>
                                    <select
                                        value={mapping[field.key] ?? ""}
                                        onChange={(e) =>
                                            setMapping((prev) => ({
                                                ...prev,
                                                [field.key]: e.target.value,
                                            }))
                                        }
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    >
                                        <option value="">— Skip —</option>
                                        {uploadData.headers.map((h) => (
                                            <option key={h} value={h}>
                                                {h}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 px-6 py-4 flex gap-3">
                            <button
                                onClick={() => setStep("upload")}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={loading}
                                className="rounded-xl w-full max-w-[200px] bg-emerald-600 px-8 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {loading ? "Importing..." : `Import ${uploadData.totalRows} rows`}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Step 3: Result ── */}
            {step === "result" && importResult && (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h2 className="mb-3 text-base font-semibold">
                        ✅ Import Complete
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-950/50">
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                {importResult.created}
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-500">
                                Created
                            </div>
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-950/50">
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                {importResult.updated}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-500">
                                Updated
                            </div>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-800 dark:bg-amber-950/50">
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                {importResult.errors.length}
                            </div>
                            <div className="text-xs text-amber-600 dark:text-amber-500">
                                Errors
                            </div>
                        </div>
                    </div>

                    {importResult.errors.length > 0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                            {importResult.errors.map((e, i) => (
                                <div key={i}>• {e}</div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex gap-3">
                        <Link
                            href="/units"
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Go to Units →
                        </Link>
                        <Link
                            href="/dashboard"
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            Go to Dashboard →
                        </Link>
                        <button
                            onClick={() => {
                                setStep("upload");
                                setUploadData(null);
                                setAllRows([]);
                                setMapping({});
                                setImportResult(null);
                                setError(null);
                            }}
                            className="rounded-xl border border-slate-300 px-6 py-4 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                        >
                            Import Another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
