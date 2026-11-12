import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { barcodeSvg } from "@/lib/barcode";
import { MobileScanner } from "./MobileScanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kiểm kê tồn kho — NovaCast" };

/** Màn quét mã vạch trên điện thoại cho phiếu kiểm kê đang mở (bán lẻ hoặc kho) */
export default async function MobileAuditPage() {
  const store = await getCurrentStore();
  const audit = await prisma.stockAudit.findFirst({
    where: { storeId: store.id, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { variant: { include: { product: true } }, material: true }, orderBy: { id: "asc" } } },
  });
  const items = (audit?.items ?? []).map((i) => ({
    code: i.variant?.sku ?? i.material?.sku ?? "",
    barcode: i.variant?.barcode ?? i.material?.barcode ?? "",
    name: i.variant ? `${i.variant.product.name}${i.variant.name ? ` (${i.variant.name})` : ""}` : i.material?.name ?? "",
    img: i.variant?.product.imageUrl ?? null,
    unit: i.material?.unit ?? "cái",
    systemQty: i.systemQty,
    actualQty: i.actualQty,
  }));
  const first = items[0];
  return (
    <MobileScanner
      auditId={audit?.id ?? null}
      auditCode={audit?.code ?? null}
      items={items}
      backHref={`/${store.type.toLowerCase()}/audit`}
      previewSvg={first ? barcodeSvg(first.barcode || first.code, { height: 14 }) : ""}
    />
  );
}
