import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import RetailAuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function RetailAuditPage() {
  const store = await getCurrentStore("RETAIL");

  const variants = await prisma.productVariant.findMany({
    where: { product: { storeId: store.id, deletedAt: null } },
    include: { product: true },
  });

  const formatted = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: `${v.product.name} - ${v.name}`,
    systemQty: v.totalQty,
    actualQty: v.totalQty,
  }));

  return <RetailAuditClient initialItems={formatted} />;
}
