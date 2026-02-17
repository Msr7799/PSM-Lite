-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "IcalFeed" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastEtag" TEXT,
ADD COLUMN     "lastModified" TEXT;

-- CreateTable
CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "publicUrl" TEXT,
    "editUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelOpsSnapshot" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'BOOKING',
    "statusText" TEXT,
    "locationText" TEXT,
    "checkins48h" INTEGER NOT NULL DEFAULT 0,
    "checkouts48h" INTEGER NOT NULL DEFAULT 0,
    "guestMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "bookingMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelOpsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicPreviewCache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ogTitle" TEXT,
    "ogDesc" TEXT,
    "ogImage" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttlSeconds" INTEGER NOT NULL DEFAULT 86400,

    CONSTRAINT "PublicPreviewCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelListing_unitId_idx" ON "ChannelListing"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_channel_externalId_key" ON "ChannelListing"("channel", "externalId");

-- CreateIndex
CREATE INDEX "ChannelOpsSnapshot_unitId_capturedAt_idx" ON "ChannelOpsSnapshot"("unitId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPreviewCache_url_key" ON "PublicPreviewCache"("url");

-- CreateIndex
CREATE INDEX "PublicPreviewCache_url_idx" ON "PublicPreviewCache"("url");

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOpsSnapshot" ADD CONSTRAINT "ChannelOpsSnapshot_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
