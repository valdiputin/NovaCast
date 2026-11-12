import { prisma } from "@/lib/prisma";
import type { CatalogItem } from "@/components/docs/LinesEditor";

/** Danh mục vật tư + tồn theo vị trí cho panel chứng từ kho */
export async function warehouseCatalog(storeId: string, priceOf: "cost" = "cost") {
  const [materials, locations, levels] = await Promise.all([
    prisma.material.findMany({ where: { storeId, deletedAt: null }, orderBy: { sku: "asc" } }),
    prisma.stockLocation.findMany({ where: { storeId }, orderBy: { name: "asc" } }),
    prisma.stockLevel.findMany({ where: { storeId, materialId: { not: null } }, select: { materialId: true, locationId: true, quantity: true } }),
  ]);
  const locByName = new Map(locations.map((l) => [l.name, l.id]));
  const stock = new Map<string, Record<string, number>>();
  for (const l of levels) stock.set(l.materialId!, { ...(stock.get(l.materialId!) ?? {}), [l.locationId]: l.quantity });
  const catalog: CatalogItem[] = materials.map((m) => ({
    id: m.id,
    code: m.sku,
    barcode: m.barcode,
    name: m.name,
    img: m.imageUrl,
    unit: m.unit,
    price: priceOf === "cost" ? Number(m.costPrice) : 0,
    defaultLocationId: m.locationBin ? locByName.get(m.locationBin) : undefined,
    stockByLoc: stock.get(m.id) ?? {},
  }));
  return { catalog, locations: locations.map((l) => ({ id: l.id, name: l.name })) };
}
