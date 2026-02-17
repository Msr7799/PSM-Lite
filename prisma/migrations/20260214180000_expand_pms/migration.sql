-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'RECEIVED');

-- AlterTable: Unit
ALTER TABLE "Unit"
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BHD',
ADD COLUMN     "defaultRate" DECIMAL(12,3);

-- CreateTable: UnitContent
CREATE TABLE "UnitContent" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "houseRules" TEXT,
    "checkInInfo" TEXT,
    "checkOutInfo" TEXT,
    "amenities" JSONB,
    "listingUrl" TEXT,
    "locationNote" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitContent_unitId_key" ON "UnitContent"("unitId");

-- CreateTable: ChannelContent
CREATE TABLE "ChannelContent" (
    "id" TEXT NOT NULL,
    "unitContentId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "houseRules" TEXT,
    "checkInInfo" TEXT,
    "checkOutInfo" TEXT,
    "amenities" JSONB,
    "listingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelContent_unitContentId_channel_key" ON "ChannelContent"("unitContentId", "channel");

-- CreateIndex
CREATE INDEX "ChannelContent_unitContentId_channel_idx" ON "ChannelContent"("unitContentId", "channel");

-- CreateTable: PublishSnapshot
CREATE TABLE "PublishSnapshot" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "section" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PublishSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishSnapshot_unitId_channel_section_publishedAt_idx" ON "PublishSnapshot"("unitId", "channel", "section", "publishedAt");

-- CreateTable: RateRule
CREATE TABLE "RateRule" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel",
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "baseRate" DECIMAL(12,3) NOT NULL,
    "weekendRate" DECIMAL(12,3),
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "daysOfWeek" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateRule_unitId_startDate_endDate_idx" ON "RateRule"("unitId", "startDate", "endDate");

-- CreateTable: Payout
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "payoutDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BHD',
    "amount" DECIMAL(12,3) NOT NULL,
    "providerRef" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'RECEIVED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayoutLine
CREATE TABLE "PayoutLine" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amount" DECIMAL(12,3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutLine_bookingId_idx" ON "PayoutLine"("bookingId");

-- CreateIndex
CREATE INDEX "PayoutLine_payoutId_idx" ON "PayoutLine"("payoutId");

-- AddForeignKey
ALTER TABLE "UnitContent" ADD CONSTRAINT "UnitContent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelContent" ADD CONSTRAINT "ChannelContent_unitContentId_fkey" FOREIGN KEY ("unitContentId") REFERENCES "UnitContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishSnapshot" ADD CONSTRAINT "PublishSnapshot_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutLine" ADD CONSTRAINT "PayoutLine_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
