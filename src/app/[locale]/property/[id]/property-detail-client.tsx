"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type PropertyData = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  tonightRate: string | null;
  defaultRate: string | null;
  title: string | null;
  description: string | null;
  houseRules: string | null;
  checkInInfo: string | null;
  checkOutInfo: string | null;
  amenities: string[];
  images: string[];
  locationNote: string | null;
  address: string | null;
  guestCapacity: string | null;
  propertyHighlights: string | null;
  nearbyPlaces: string | null;
  damageDeposit: string | null;
  cancellationPolicy: string | null;
  bookingPublicUrl: string | null;
  bookingPropertyId: string | null;
  preview: {
    ogTitle: string | null;
    ogDesc: string | null;
    ogImage: string | null;
  } | null;
  channels: Array<{
    channel: string;
    publicUrl: string | null;
    externalId: string;
  }>;
  snapshot: {
    statusText: string | null;
    locationText: string | null;
    checkins48h: number;
    checkouts48h: number;
    guestMessagesCount: number;
    bookingMessagesCount: number;
  } | null;
};

export default function PropertyDetailClient() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const id = params?.id as string;

  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/property/${id}`);
      const data = await res.json();
      if (data.property) setProperty(data.property);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  function openLightbox(idx: number) {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function nextImage() {
    if (!property) return;
    setLightboxIdx((i) => (i + 1) % property.images.length);
  }

  function prevImage() {
    if (!property) return;
    setLightboxIdx((i) => (i - 1 + property.images.length) % property.images.length);
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, property]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-500">{t("loading")}</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Property not found</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          ← {t("back")}
        </button>
      </div>
    );
  }

  const displayTitle = property.title || property.preview?.ogTitle || property.name;
  const displayDesc = property.description || property.preview?.ogDesc || "";
  const heroImage = property.images[0] || property.preview?.ogImage;
  const highlights = property.propertyHighlights?.split("\n").filter(Boolean) ?? [];
  const amenitiesList = property.amenities ?? [];
  const nearbyList = property.nearbyPlaces?.split("\n").filter(Boolean) ?? [];

  return (
    <>
      {/* Lightbox */}
      {lightboxOpen && property.images.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-4 end-4 z-50 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute start-4 z-50 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <img
            src={property.images[lightboxIdx]}
            alt={`${displayTitle} - ${lightboxIdx + 1}`}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute end-4 z-50 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-4 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">
            {lightboxIdx + 1} / {property.images.length}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 transition dark:text-slate-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("back")}
        </button>

        {/* Hero Section */}
        {property.images.length > 0 ? (
          <div className="grid gap-2 overflow-hidden rounded-2xl" style={{
            gridTemplateColumns: property.images.length >= 3 ? "2fr 1fr 1fr" : property.images.length === 2 ? "1fr 1fr" : "1fr",
            gridTemplateRows: property.images.length >= 3 ? "200px 200px" : "400px",
          }}>
            {/* Main image */}
            <div
              className={`relative cursor-pointer overflow-hidden ${property.images.length >= 3 ? "row-span-2" : ""}`}
              onClick={() => openLightbox(0)}
            >
              <img
                src={property.images[0]}
                alt={displayTitle}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
              {property.snapshot?.statusText && (
                <span className="absolute top-3 end-3 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-medium text-white shadow-lg">
                  {property.snapshot.statusText}
                </span>
              )}
            </div>

            {/* Side images */}
            {property.images.slice(1, 5).map((src, i) => (
              <div
                key={i}
                className="relative cursor-pointer overflow-hidden"
                onClick={() => openLightbox(i + 1)}
              >
                <img
                  src={src}
                  alt={`${displayTitle} - ${i + 2}`}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
                {i === 3 && property.images.length > 5 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    <span className="text-lg font-semibold">+{property.images.length - 5} {t("images_count")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : heroImage ? (
          <div className="overflow-hidden rounded-2xl">
            <img src={heroImage} alt={displayTitle} className="h-80 w-full object-cover" />
          </div>
        ) : null}

        {/* Title & Price Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{displayTitle}</h1>
              {property.address && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <span>📍</span>
                  <span>{property.address}</span>
                </div>
              )}
              {property.guestCapacity && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <span>👥</span>
                  <span>{property.guestCapacity}</span>
                </div>
              )}
              {property.code && (
                <div className="mt-1 text-xs text-slate-400">
                  {t("code_optional")}: {property.code}
                </div>
              )}
            </div>

            {/* Price Card */}
            <div className="shrink-0 rounded-xl bg-blue-50 p-4 text-center dark:bg-blue-950/40">
              {property.tonightRate ? (
                <>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {property.tonightRate} {property.currency}
                  </div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70">/ {t("night") || "night"}</div>
                </>
              ) : property.defaultRate ? (
                <>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {property.defaultRate} {property.currency}
                  </div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70">/ {t("night") || "night"}</div>
                </>
              ) : (
                <div className="text-sm text-slate-400">{t("no_rate") || "No rate set"}</div>
              )}
            </div>
          </div>

          {/* Channel Links */}
          {property.channels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {property.channels.map((ch, i) => (
                ch.publicUrl ? (
                  <a
                    key={i}
                    href={ch.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white transition hover:opacity-90 ${
                      ch.channel === "BOOKING" ? "bg-indigo-600" :
                      ch.channel === "AIRBNB" ? "bg-rose-600" :
                      ch.channel === "AGODA" ? "bg-emerald-600" : "bg-slate-600"
                    }`}
                  >
                    {ch.channel} ↗
                  </a>
                ) : (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    {ch.channel}: {ch.externalId}
                  </span>
                )
              ))}
            </div>
          )}
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("property_highlights")}</h2>
            <div className="flex flex-wrap gap-2">
              {highlights.map((h, i) => (
                <span
                  key={i}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {displayDesc && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("description")}</h2>
            <div className="prose prose-sm prose-slate max-w-none dark:prose-invert whitespace-pre-line leading-relaxed">
              {displayDesc}
            </div>
          </div>
        )}

        {/* Two Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Amenities */}
          {amenitiesList.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold mb-3">{t("amenities")}</h2>
              <div className="grid grid-cols-2 gap-2">
                {amenitiesList.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-500">✓</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Check-in / Check-out / House Rules */}
          <div className="space-y-4">
            {(property.checkInInfo || property.checkOutInfo) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-semibold mb-3">{t("check_in")} / {t("check_out")}</h2>
                <div className="space-y-2">
                  {property.checkInInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">↓</span>
                      <span>{property.checkInInfo}</span>
                    </div>
                  )}
                  {property.checkOutInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">↑</span>
                      <span>{property.checkOutInfo}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {property.damageDeposit && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-semibold mb-2">{t("damage_deposit")}</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">{property.damageDeposit}</p>
              </div>
            )}

            {property.cancellationPolicy && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-semibold mb-2">{t("cancellation_policy")}</h2>
                <p className="text-sm text-slate-700 dark:text-slate-300">{property.cancellationPolicy}</p>
              </div>
            )}
          </div>
        </div>

        {/* House Rules */}
        {property.houseRules && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("house_rules")}</h2>
            <div className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {property.houseRules}
            </div>
          </div>
        )}

        {/* Nearby Places */}
        {nearbyList.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("nearby_places")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {nearbyList.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span>📍</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Note */}
        {property.locationNote && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("location_note") || "Location"}</h2>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{property.locationNote}</p>
          </div>
        )}

        {/* All Images Gallery */}
        {property.images.length > 5 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("images_count") ? `${property.images.length} ${t("images_count")}` : `${property.images.length} Images`}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {property.images.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 transition hover:opacity-80"
                  onClick={() => openLightbox(i)}
                >
                  <img src={src} alt={`${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operational Snapshot */}
        {property.snapshot && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold mb-3">{t("operations") || "Operations"}</h2>
            <div className="flex flex-wrap gap-3">
              {property.snapshot.checkins48h > 0 && (
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                  ↓ {property.snapshot.checkins48h} check-ins (48h)
                </span>
              )}
              {property.snapshot.checkouts48h > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  ↑ {property.snapshot.checkouts48h} check-outs (48h)
                </span>
              )}
              {property.snapshot.guestMessagesCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-sm text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                  💬 {property.snapshot.guestMessagesCount} messages
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
