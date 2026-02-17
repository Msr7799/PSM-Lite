"use client";

import { useState, useEffect, useCallback } from "react";

type DashboardCard = {
    id: string;
    name: string;
    code: string | null;
    currency: string;
    address: string | null;
    guestCapacity: string | null;
    propertyHighlights: string | null;
    bookingPublicUrl: string | null;
    bookingPropertyId: string | null;
    tonightRate: string | null;
    preview: {
        ogTitle: string | null;
        ogDesc: string | null;
        ogImage: string | null;
    } | null;
    snapshot: {
        statusText: string | null;
        locationText: string | null;
        checkins48h: number;
        checkouts48h: number;
        guestMessagesCount: number;
        bookingMessagesCount: number;
    } | null;
};

function buildBookingUrl(publicUrl: string): string {
    try {
        const url = new URL(publicUrl);
        const today = new Date();
        const checkin = today.toISOString().slice(0, 10);
        const checkout = new Date(today.getTime() + 2 * 86400000)
            .toISOString()
            .slice(0, 10);

        url.searchParams.set("checkin", checkin);
        url.searchParams.set("checkout", checkout);
        url.searchParams.set("group_adults", "2");
        url.searchParams.set("no_rooms", "1");
        url.searchParams.set("group_children", "0");
        return url.toString();
    } catch {
        return publicUrl;
    }
}

export default function DashboardClient() {
    const [cards, setCards] = useState<DashboardCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchingPreview, setFetchingPreview] = useState<string | null>(null);

    const loadCards = useCallback(async () => {
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();
            if (data.cards) setCards(data.cards);
        } catch {
            setError("Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCards();
    }, [loadCards]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await fetch("/api/sync", { method: "POST" });
            await loadCards();
        } catch {
            setError("Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    const handleFetchPreview = async (card: DashboardCard) => {
        if (!card.bookingPublicUrl) return;
        setFetchingPreview(card.id);
        try {
            await fetch("/api/booking/public-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: card.bookingPublicUrl }),
            });
            await loadCards();
        } catch {
            setError("Preview fetch failed");
        } finally {
            setFetchingPreview(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="animate-pulse text-slate-500">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Actions bar */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {syncing ? "⏳ Syncing..." : "🔄 Sync All"}
                </button>
                <button
                    onClick={loadCards}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                    ↻ Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                    ❌ {error}
                    <button onClick={() => setError(null)} className="ms-2 underline">
                        dismiss
                    </button>
                </div>
            )}

            {cards.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-slate-500">No units found. Import properties first.</p>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
                    >
                        {/* Image */}
                        {card.preview?.ogImage ? (
                            <div className="relative h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                <img
                                    src={card.preview.ogImage}
                                    alt={card.preview.ogTitle ?? card.name}
                                    className="h-full w-full object-cover transition group-hover:scale-105"
                                />
                                {card.snapshot?.statusText && (
                                    <span className="absolute top-2 end-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-xs font-medium text-white shadow">
                                        {card.snapshot.statusText}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                                <span className="text-3xl">🏨</span>
                                {card.bookingPublicUrl && (
                                    <button
                                        onClick={() => handleFetchPreview(card)}
                                        disabled={fetchingPreview === card.id}
                                        className="absolute rounded-lg bg-blue-600/90 px-2 py-1 text-xs text-white shadow transition hover:bg-blue-700"
                                    >
                                        {fetchingPreview === card.id
                                            ? "Fetching..."
                                            : "Fetch Preview"}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex flex-1 flex-col p-4">
                            <h3 className="text-sm font-semibold leading-tight">
                                {card.preview?.ogTitle ?? card.name}
                            </h3>

                            {card.preview?.ogDesc && (
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                    {card.preview.ogDesc}
                                </p>
                            )}

                            {/* Location & Capacity */}
                            {(card.address || card.snapshot?.locationText) && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                                    <span>📍</span>
                                    <span className="line-clamp-1">
                                        {card.address ?? card.snapshot?.locationText}
                                    </span>
                                </div>
                            )}
                            {card.guestCapacity && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                    <span>👥</span>
                                    <span>{card.guestCapacity}</span>
                                </div>
                            )}

                            {/* Property Highlights */}
                            {card.propertyHighlights && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {card.propertyHighlights.split("\n").filter(Boolean).slice(0, 4).map((h, i) => (
                                        <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            {h}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Rate */}
                            {card.tonightRate && (
                                <div className="mt-2 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                    💰 {card.tonightRate} {card.currency}/night
                                </div>
                            )}

                            {/* Badges */}
                            {card.snapshot && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {card.snapshot.checkins48h > 0 && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                            ↓ {card.snapshot.checkins48h} check-ins
                                        </span>
                                    )}
                                    {card.snapshot.checkouts48h > 0 && (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                            ↑ {card.snapshot.checkouts48h} check-outs
                                        </span>
                                    )}
                                    {card.snapshot.guestMessagesCount > 0 && (
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                                            💬 {card.snapshot.guestMessagesCount}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Booking.com Link */}
                            {card.bookingPublicUrl && (
                                <a
                                    href={buildBookingUrl(card.bookingPublicUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-auto block rounded-xl bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 mt-3"
                                >
                                    Open on Booking.com ↗
                                </a>
                            )}

                            {card.bookingPropertyId && !card.bookingPublicUrl && (
                                <div className="mt-auto mt-3 text-xs text-slate-400">
                                    ID: {card.bookingPropertyId}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
