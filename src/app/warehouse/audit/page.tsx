import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import WarehouseAuditClient from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function WarehouseAuditPage() {
  const store = await getCurrentStore("WAREHOUSE");

  const materials = await prisma.material.findMany({
    where: { storeId: store.id, deletedAt: null },
    select: { id: true, sku: true, name: true, totalQty: true },
  });

  return <WarehouseAuditClient materials={materials} />;
}
