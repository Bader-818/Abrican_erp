-- CreateEnum
CREATE TYPE "VehicleClass" AS ENUM ('LIGHT', 'HEAVY');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "aramcoStickerExpiry" TIMESTAMP(3),
ADD COLUMN     "color" TEXT,
ADD COLUMN     "doorNumber" TEXT,
ADD COLUMN     "operatingCardExpiry" TIMESTAMP(3),
ADD COLUMN     "plateColor" TEXT,
ADD COLUMN     "plateNumberAr" TEXT,
ADD COLUMN     "vehicleClass" "VehicleClass";
