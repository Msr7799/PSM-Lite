import { prisma } from "@/lib/prisma";
import { snapshotContent } from "@/lib/content";
import { checksumOfJson } from "@/lib/checksum";
import { Channel } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const unitId = url.searchParams.get("unitId") ?? "";
  if (!unitId) return new Response("unitId required", { status: 400 });

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { content: { include: { channelContents: true } } },
  });

  if (!unit) return new Response("Unit not found", { status: 404 });

  const uc = unit.content as any;
  const master = uc
    ? {
        title: uc.title,
        description: uc.description,
        houseRules: uc.houseRules,
        checkInInfo: uc.checkInInfo,
        checkOutInfo: uc.checkOutInfo,
        amenities: uc.amenities ?? [],
        locationNote: uc.locationNote,
        address: uc.address ?? "",
        guestCapacity: uc.guestCapacity ?? "",
        propertyHighlights: uc.propertyHighlights ?? "",
        nearbyPlaces: uc.nearbyPlaces ?? "",
        damageDeposit: uc.damageDeposit ?? "",
        cancellationPolicy: uc.cancellationPolicy ?? "",
      }
    : {
        title: "",
        description: "",
        houseRules: "",
        checkInInfo: "",
        checkOutInfo: "",
        amenities: [],
        locationNote: "",
        address: "",
        guestCapacity: "",
        propertyHighlights: "",
        nearbyPlaces: "",
        damageDeposit: "",
        cancellationPolicy: "",
      };

  const overrideByChannel: Record<string, any> = {};
  for (const cc of unit.content?.channelContents ?? []) {
    overrideByChannel[cc.channel] = {
      title: cc.title ?? undefined,
      description: cc.description ?? undefined,
      houseRules: cc.houseRules ?? undefined,
      checkInInfo: cc.checkInInfo ?? undefined,
      checkOutInfo: cc.checkOutInfo ?? undefined,
      amenities: (cc.amenities as any) ?? undefined,
      listingUrl: cc.listingUrl ?? undefined,
    };
  }

  const channels: Channel[] = [Channel.BOOKING, Channel.AIRBNB, Channel.AGODA];

  const current = await Promise.all(
    channels.map(async (ch) => {
      const snap = snapshotContent(ch, master, overrideByChannel[ch] ?? {});
      const checksum = checksumOfJson(snap);

      const last = await prisma.publishSnapshot.findFirst({
        where: { unitId, channel: ch, section: "CONTENT" },
        orderBy: { publishedAt: "desc" },
      });

      return {
        channel: ch,
        listingUrl: (overrideByChannel[ch]?.listingUrl as string | undefined) ?? null,
        currentChecksum: checksum,
        lastChecksum: last?.checksum ?? null,
        changed: !last ? true : last.checksum !== checksum,
        lastPublishedAt: last?.publishedAt ? last.publishedAt.toISOString() : null,
        draft: {
          title: (snap as any).title,
          body: (snap as any).body,
        },
      };
    })
  );

  return Response.json({ unitId, current });
}
