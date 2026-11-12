-- CreateEnum
CREATE TYPE "SlipKind" AS ENUM ('CUSTOMER_RETURN', 'DISPOSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "minStock" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "stockQty" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "code" TEXT,
ADD COLUMN     "soldCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "stock_audits" ADD COLUMN     "createdByName" TEXT;

-- AlterTable
ALTER TABLE "stock_issues" ADD COLUMN     "createdByName" TEXT;

-- AlterTable
ALTER TABLE "stock_receipts" ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "receiptType" TEXT NOT NULL DEFAULT 'SUPPLIER';

-- CreateTable
CREATE TABLE "return_slips" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "SlipKind" NOT NULL,
    "customerName" TEXT,
    "partnerId" TEXT,
    "condition" "ReturnCondition",
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "slipDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" BIGINT NOT NULL DEFAULT 0,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_slip_items" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" BIGINT NOT NULL DEFAULT 0,
    "totalAmount" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "return_slip_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_slips_storeId_kind_slipDate_idx" ON "return_slips"("storeId", "kind", "slipDate");

-- CreateIndex
CREATE UNIQUE INDEX "return_slips_storeId_code_key" ON "return_slips"("storeId", "code");

-- AddForeignKey
ALTER TABLE "return_slips" ADD CONSTRAINT "return_slips_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_slip_items" ADD CONSTRAINT "return_slip_items_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "return_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_slip_items" ADD CONSTRAINT "return_slip_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
