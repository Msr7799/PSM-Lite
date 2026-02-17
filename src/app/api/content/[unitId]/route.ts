import { prisma } from "@/lib/prisma";
import { generateChannelDraft } from "@/lib/content";
import { getOrFetchPublicPreview } from "@/lib/publicPreview";
import { Channel } from "@prisma/client";
import { z } from "zod";

const ChannelSchema = z.enum(["BOOKING", "AIRBNB", "AGODA"]);

const MasterSchema = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  houseRules: z.string().optional().nullable(),
  checkInInfo: z.string().optional().nullable(),
  checkOutInfo: z.string().optional().nullable(),
  amenities: z.array(z.string()).optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  locationNote: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  guestCapacity: z.string().optional().nullable(),
  propertyHighlights: z.string().optional().nullable(),
  nearbyPlaces: z.string().optional().nullable(),
  damageDeposit: z.string().optional().nullable(),
  cancellationPolicy: z.string().optional().nullable(),
});

const OverridesSchema = z.record(
  ChannelSchema,
  z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    houseRules: z.string().optional(),
    checkInInfo: z.string().optional(),
    checkOutInfo: z.string().optional(),
    amenities: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    listingUrl: z.string().optional(),
  })
);

const PutSchema = z.object({
  master: MasterSchema,
  overrides: OverridesSchema.optional(),
});

function normalizeContent(s?: string | null) {
  return (s ?? "").trim();
}

function normalizeArr(a?: string[] | null) {
  return (a ?? []).map((x) => String(x).trim()).filter(Boolean);
}

function asChannelContent(master: any, override: any) {
  // Save only overrides that are non-empty to keep DB clean.
  const cleaned: any = {};
  const fields = ["title", "description", "houseRules", "checkInInfo", "checkOutInfo", "listingUrl"];
  for (const f of fields) {
    const v = normalizeContent(override?.[f]);
    if (v) cleaned[f] = v;
  }
  const am = normalizeArr(override?.amenities);
  if (am.length) cleaned.amenities = am;

  const imgs = normalizeArr(override?.images);
  if (imgs.length) cleaned.images = imgs;

  return cleaned;
}

function buildResponse(unitId: string, master: any, overrides: any, externalData: any = null) {
  const channels: Channel[] = [Channel.BOOKING, Channel.AIRBNB, Channel.AGODA];

  const masterOut = {
    title: normalizeContent(master?.title),
    description: normalizeContent(master?.description),
    houseRules: normalizeContent(master?.houseRules),
    checkInInfo: normalizeContent(master?.checkInInfo),
    checkOutInfo: normalizeContent(master?.checkOutInfo),
    amenities: normalizeArr(master?.amenities),
    images: normalizeArr(master?.images),
    locationNote: normalizeContent(master?.locationNote),
    address: normalizeContent(master?.address),
    guestCapacity: normalizeContent(master?.guestCapacity),
    propertyHighlights: normalizeContent(master?.propertyHighlights),
    nearbyPlaces: normalizeContent(master?.nearbyPlaces),
    damageDeposit: normalizeContent(master?.damageDeposit),
    cancellationPolicy: normalizeContent(master?.cancellationPolicy),
  };

  const overridesOut: any = { BOOKING: {}, AIRBNB: {}, AGODA: {} };
  for (const ch of channels) {
    const key = ch as any;
    const o = overrides?.[key] ?? {};
    overridesOut[key] = {
      ...o,
      amenities: normalizeArr(o?.amenities),
      images: normalizeArr(o?.images),
    };
  }

  const draftsOut: any = {};
  for (const ch of channels) {
    const key = ch as any;
    const draft = generateChannelDraft(ch, masterOut, overridesOut[key]);
    draftsOut[key] = { title: draft.title, body: draft.body, charCount: draft.body.length };
  }

  return { unitId, master: masterOut, overrides: overridesOut, drafts: draftsOut, externalData };
}

export async function GET(req: Request, ctx: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const fetchExternal = searchParams.get('fetchExternal') === 'true';

  if (!unitId) return new Response("Missing unitId", { status: 400 });

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      content: { include: { channelContents: true } },
      channelListings: true,
    },
  });
  if (!unit) return new Response("Unit not found", { status: 404 });

  const master = unit.content ?? null;

  const overrides: any = { BOOKING: {}, AIRBNB: {}, AGODA: {} };
  if (unit.content?.channelContents?.length) {
    for (const cc of unit.content.channelContents) {
      const key = cc.channel as any;
      overrides[key] = {
        title: cc.title ?? undefined,
        description: cc.description ?? undefined,
        houseRules: cc.houseRules ?? undefined,
        checkInInfo: cc.checkInInfo ?? undefined,
        checkOutInfo: cc.checkOutInfo ?? undefined,
        amenities: (cc.amenities as any) ?? undefined,
        images: (cc.images as any) ?? undefined,
        listingUrl: cc.listingUrl ?? undefined,
      };
    }
  }

  let externalData: any = null;
  // If we have listings, we can try to get previews from them to help the user fill content
  if (fetchExternal && unit.channelListings.length > 0) {
    for (const listing of unit.channelListings) {
      if (listing.publicUrl) {
        try {
          const preview = await getOrFetchPublicPreview(listing.publicUrl);
          if (preview) {
            const det = (preview.details ?? {}) as any;
            externalData = {
              title: preview.ogTitle,
              description: det.description || preview.ogDesc,
              images: preview.images || (preview.ogImage ? [preview.ogImage] : []),
              amenities: preview.amenities || [],
              houseRules: det.houseRules || null,
              checkInInfo: det.checkInInfo || null,
              checkOutInfo: det.checkOutInfo || null,
              address: det.address || null,
              rating: det.rating || null,
              source: preview.channel || listing.channel,
              guestCapacity: det.guestCapacity || null,
              propertyHighlights: det.propertyHighlights || null,
              nearbyPlaces: det.nearbyPlaces || null,
              damageDeposit: det.damageDeposit || null,
              cancellationPolicy: det.cancellationPolicy || null,
              // Extended fields
              propertyId: det.propertyId || null,
              coordinates: det.coordinates || null,
              accommodationType: det.accommodationType || null,
              roomSize: det.roomSize || null,
              bedroomCount: det.bedroomCount || null,
              bathroomCount: det.bathroomCount || null,
              checkInTime: det.checkInTime || null,
              checkOutTime: det.checkOutTime || null,
              quietHours: det.quietHours || null,
              minCheckInAge: det.minCheckInAge || null,
              smokingPolicy: det.smokingPolicy || null,
              petsPolicy: det.petsPolicy || null,
              partiesPolicy: det.partiesPolicy || null,
              childrenPolicy: det.childrenPolicy || null,
              paymentMethods: det.paymentMethods || null,
              hostName: det.hostName || null,
              hostJoinDate: det.hostJoinDate || null,
              finePrints: det.finePrints || null,
              currency: det.currency || null,
              nearbyPlacesDetailed: det.nearbyPlacesDetailed || null,
            };
            break;
          }
        } catch (e) {
          console.error("Failed to fetch preview for", listing.publicUrl, e);
        }
      }
    }
  }

  return Response.json(buildResponse(unitId, master, overrides, externalData));
}

export async function PUT(req: Request, ctx: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await ctx.params;
  if (!unitId) return new Response("Missing unitId", { status: 400 });

  const body = await req.json();
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return new Response(parsed.error.message, { status: 400 });

  const masterIn = parsed.data.master;
  const overridesIn = parsed.data.overrides ?? ({} as any);

  // Ensure UnitContent exists
  const existing = await prisma.unitContent.findUnique({ where: { unitId } });

  const masterData = {
    title: normalizeContent(masterIn.title),
    description: normalizeContent(masterIn.description),
    houseRules: normalizeContent(masterIn.houseRules),
    checkInInfo: normalizeContent(masterIn.checkInInfo),
    checkOutInfo: normalizeContent(masterIn.checkOutInfo),
    amenities: normalizeArr(masterIn.amenities),
    images: normalizeArr(masterIn.images),
    locationNote: normalizeContent(masterIn.locationNote),
    address: normalizeContent(masterIn.address),
    guestCapacity: normalizeContent(masterIn.guestCapacity),
    propertyHighlights: normalizeContent(masterIn.propertyHighlights),
    nearbyPlaces: normalizeContent(masterIn.nearbyPlaces),
    damageDeposit: normalizeContent(masterIn.damageDeposit),
    cancellationPolicy: normalizeContent(masterIn.cancellationPolicy),
  };

  const content = existing
    ? await prisma.unitContent.update({
      where: { unitId },
      data: masterData,
      include: { channelContents: true },
    })
    : await prisma.unitContent.create({
      data: { unitId, ...masterData },
      include: { channelContents: true },
    });

  // Upsert overrides for the 3 channels
  const channels: Channel[] = [Channel.BOOKING, Channel.AIRBNB, Channel.AGODA];
  for (const ch of channels) {
    const key = ch as any;
    const o = overridesIn[key] ?? {};
    const data = asChannelContent(masterData, o);

    // If empty -> delete existing override row
    const hasAny = Object.keys(data).length > 0;

    const existingCc = content.channelContents.find((x) => x.channel === ch);
    if (!hasAny) {
      if (existingCc) {
        await prisma.channelContent.delete({ where: { id: existingCc.id } });
      }
      continue;
    }

    if (existingCc) {
      await prisma.channelContent.update({
        where: { id: existingCc.id },
        data: {
          title: data.title ?? null,
          description: data.description ?? null,
          houseRules: data.houseRules ?? null,
          checkInInfo: data.checkInInfo ?? null,
          checkOutInfo: data.checkOutInfo ?? null,
          amenities: data.amenities ?? undefined,
          images: data.images ?? undefined,
          listingUrl: data.listingUrl ?? null,
        },
      });
    } else {
      await prisma.channelContent.create({
        data: {
          unitContentId: content.id,
          channel: ch,
          title: data.title ?? null,
          description: data.description ?? null,
          houseRules: data.houseRules ?? null,
          checkInInfo: data.checkInInfo ?? null,
          checkOutInfo: data.checkOutInfo ?? null,
          amenities: data.amenities ?? undefined,
          images: data.images ?? undefined,
          listingUrl: data.listingUrl ?? null,
        },
      });
    }
  }

  // reload and respond
  const fresh = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { content: { include: { channelContents: true } } },
  });

  const overrides: any = { BOOKING: {}, AIRBNB: {}, AGODA: {} };
  for (const cc of fresh?.content?.channelContents ?? []) {
    const key = cc.channel as any;
    overrides[key] = {
      title: cc.title ?? undefined,
      description: cc.description ?? undefined,
      houseRules: cc.houseRules ?? undefined,
      checkInInfo: cc.checkInInfo ?? undefined,
      checkOutInfo: cc.checkOutInfo ?? undefined,
      amenities: (cc.amenities as any) ?? undefined,
      images: (cc.images as any) ?? undefined,
      listingUrl: cc.listingUrl ?? undefined,
    };
  }

  return Response.json(buildResponse(unitId, fresh?.content ?? null, overrides));
}
