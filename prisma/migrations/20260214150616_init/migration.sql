-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('BOOKING', 'AIRBNB', 'AGODA', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedType" AS ENUM ('URL', 'INLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('CLEANING', 'MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'STAFF', 'OTHER');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcalFeed" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "type" "FeedType" NOT NULL,
    "name" TEXT,
    "url" TEXT,
    "icsText" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcalFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalUid" TEXT NOT NULL,
    "summary" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'BHD',
    "grossAmount" DECIMAL(12,3),
    "commissionAmount" DECIMAL(12,3),
    "taxAmount" DECIMAL(12,3),
    "otherFeesAmount" DECIMAL(12,3),
    "netAmount" DECIMAL(12,3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BHD',
    "spentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IcalFeed_unitId_channel_idx" ON "IcalFeed"("unitId", "channel");

-- CreateIndex
CREATE INDEX "Booking_unitId_startDate_endDate_idx" ON "Booking"("unitId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_unitId_channel_externalUid_key" ON "Booking"("unitId", "channel", "externalUid");

-- CreateIndex
CREATE INDEX "Expense_unitId_spentAt_idx" ON "Expense"("unitId", "spentAt");

-- AddForeignKey
ALTER TABLE "IcalFeed" ADD CONSTRAINT "IcalFeed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
