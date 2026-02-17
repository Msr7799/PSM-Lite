-- AlterTable
ALTER TABLE "ChannelContent" ADD COLUMN     "images" JSONB;

-- AlterTable
ALTER TABLE "PublicPreviewCache" ADD COLUMN     "amenities" JSONB,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "images" JSONB;

-- AlterTable
ALTER TABLE "UnitContent" ADD COLUMN     "images" JSONB;
