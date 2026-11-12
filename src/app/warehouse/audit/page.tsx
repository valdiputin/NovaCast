import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { KpiStat, PageBody } from "@/components/ui/kit";
import { AuditBoard } from "@/components/inventory/AuditBoard";
import { MATERIAL_TYPE } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { Box, AlertTriangle, CheckCircle2, History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WarehouseAuditPage() {
  const store = await getCurrentStore("WAREHOUSE");
  const [audit, materials, drafts, lastApproved] = await Promise.all([
    prisma.stockAudit.findFirst({
      where: { storeId: store.id, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { material: true }, orderBy: { id: "asc" } } },
    }),
    prisma.material.findMany({ where: { storeId: store.id, deletedAt: null }, select: { totalQty: true, minStock: true, costPrice: true } }),
    prisma.stockAudit.count({ where: { storeId: store.id, status: "DRAFT" } }),
    prisma.stockAudit.findFirst({ where: { storeId: store.id, status: "APPROVED" }, orderBy: { auditDate: "desc" } }),
  ]);
  const value = materials.reduce((s, m) => s + m.totalQty * Number(m.costPrice), 0);
  const low = materials.filter((m) => m.totalQty <= m.minStock).length;
  const rows = (audit?.items ?? [])
    .filter((i) => i.material)
    .map((i) => ({
      itemId: i.id,
      sku: i.material!.sku,
      barcode: i.material!.barcode,
      img: i.material!.imageUrl,
      name: i.material!.name.replace(/\s*\((Cuộn|Kg|Cái)\)$/i, ""),
      unit: i.material!.unit,
      locationName: "",
      systemQty: i.systemQty,
      actualQty: i.actualQty,
      reason: i.reason ?? "",
      unitCost: Number(i.material!.costPrice),
      ref: { materialId: i.materialId! },
    }));

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Kiểm kê & Tồn kho" />
      <PageBody>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiStat icon={<Box className="w-9 h-9" />} tileClass="bg-blue-50 text-[#1565F5]" value={value.toLocaleString("vi-VN")} label="Tổng giá trị tồn kho (VNĐ)" />
          <KpiStat icon={<AlertTriangle className="w-9 h-9 text-white" fill="#F59E0B" />} tileClass="bg-amber-50" value={low} label="Mặt hàng sắp hết" href="/warehouse/items?status=low" />
          <KpiStat icon={<CheckCircle2 className="w-9 h-9 text-white" fill="#16A34A" />} tileClass="bg-emerald-50" value={drafts} label="Phiên kiểm kê đang thực hiện" />
          <KpiStat icon={<History className="w-9 h-9" />} tileClass="bg-purple-50 text-purple-600" value={lastApproved ? formatDate(lastApproved.auditDate) : "—"} label="Lần kiểm kê gần nhất" />
        </div>
        <AuditBoard
          variant="warehouse"
          audit={audit ? { id: audit.id, code: audit.code } : null}
          rows={rows}
          filterLabel="Loại hàng"
          filterOptions={Object.entries(MATERIAL_TYPE).map(([v, t]) => ({ value: v, label: t.label }))}
        />
      </PageBody>
    </div>
  );
}
