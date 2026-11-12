import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { KpiStat, PageBody } from "@/components/ui/kit";
import { AuditBoard } from "@/components/inventory/AuditBoard";
import { barcodeSvg } from "@/lib/barcode";
import { lowStockVariants, sellable } from "@/lib/retailStats";
import { formatDateTime } from "@/lib/format";
import { Box, AlertTriangle, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RetailAuditPage() {
  const store = await getCurrentStore("RETAIL");
  const [audit, variants, low, categories, lastAny] = await Promise.all([
    prisma.stockAudit.findFirst({
      where: { storeId: store.id, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { variant: { include: { product: true } } }, orderBy: { id: "asc" } } },
    }),
    prisma.productVariant.findMany({ where: { deletedAt: null, product: { storeId: store.id, deletedAt: null } }, select: { shelfQty: true, warehouseQty: true, costPrice: true } }),
    lowStockVariants(store.id, 0),
    prisma.category.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { order: "asc" } }),
    prisma.stockAudit.findFirst({ where: { storeId: store.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } }),
  ]);
  const drafts = await prisma.stockAudit.count({ where: { storeId: store.id, status: "DRAFT" } });
  const value = variants.reduce((s, v) => s + sellable(v) * Number(v.costPrice), 0);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const scanUrl = `${proto}://${host}/m/audit`;

  const rows = (audit?.items ?? [])
    .filter((i) => i.variant)
    .map((i) => ({
      itemId: i.id,
      sku: i.variant!.sku,
      barcode: i.variant!.barcode,
      barcodeSvg: barcodeSvg(i.variant!.barcode ?? i.variant!.sku, { height: 8 }),
      img: i.variant!.product.imageUrl,
      name: `${i.variant!.product.name}${i.variant!.name && i.variant!.name.length <= 3 ? ` (${i.variant!.name})` : i.variant!.name ? ` (${i.variant!.name})` : ""}`,
      locationName: "",
      systemQty: i.systemQty,
      actualQty: i.actualQty,
      reason: i.reason ?? "",
      unitCost: Number(i.variant!.costPrice),
      ref: { variantId: i.variantId! },
    }));

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Kiểm kê tồn kho" />
      <PageBody>
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_380px] xl:grid-cols-[1fr_360px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-3 gap-5">
              <KpiStat icon={<Box className="w-9 h-9" />} tileClass="bg-blue-50 text-[#1565F5]" value={value.toLocaleString("vi-VN")} label="Tổng giá trị tồn kho (VNĐ)" />
              <KpiStat icon={<AlertTriangle className="w-9 h-9 text-white" fill="#F59E0B" />} tileClass="bg-amber-50" value={low.count} label="Mã hàng sắp hết" href="/retail/products?stock=low" />
              <KpiStat
                icon={<CheckCircle2 className="w-9 h-9 text-white" fill="#16A34A" />}
                tileClass="bg-emerald-50"
                value={drafts}
                label="Phiếu kiểm kê gần nhất"
                sub={<span className="text-[15px] font-semibold text-emerald-600">{lastAny ? formatDateTime(lastAny.createdAt) : "—"}</span>}
              />
            </div>
            <AuditBoard
              variant="retail"
              audit={audit ? { id: audit.id, code: audit.code } : null}
              rows={rows}
              filterLabel="Nhóm hàng"
              filterOptions={categories.map((c) => ({ value: c.id, label: c.name }))}
              autoRefresh
            />
          </div>
          <aside className="sticky top-[100px]">
            <div className="rounded-[40px] bg-[#0F1A33] p-3 shadow-2xl">
              <iframe src="/m/audit" title="Màn quét điện thoại" allow="camera" className="w-full h-[780px] rounded-[30px] bg-white" />
            </div>
            <p className="text-center text-sm text-slate-500 mt-3">
              Mở trên điện thoại: <a href={scanUrl} target="_blank" className="text-[#1565F5] font-semibold break-all">{scanUrl}</a>
            </p>
          </aside>
        </div>
      </PageBody>
    </div>
  );
}
