import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pill, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { Thumb } from "@/components/ui/Thumb";
import { HistoryButton } from "@/components/inventory/HistoryButton";
import { MaterialEditor } from "./MaterialEditor";
import { MATERIAL_TYPE, stockState } from "@/lib/labels";
import type { MaterialType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = { q?: string; type?: string; status?: string; page?: string; size?: string };

export default async function WarehouseItemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("WAREHOUSE");
  const sp = await searchParams;
  const size = [5, 10, 20, 50].includes(Number(sp.size)) ? Number(sp.size) : 5;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.MaterialWhereInput = {
    storeId: store.id,
    deletedAt: null,
    ...(sp.type && sp.type in MATERIAL_TYPE ? { type: sp.type as MaterialType } : {}),
    ...(sp.q ? { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { name: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [allMatching, bins] = await Promise.all([
    prisma.material.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.stockLocation.findMany({ where: { storeId: store.id }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  // Lọc trạng thái tồn (tính theo tồn & định mức)
  const filtered = allMatching.filter((m) => {
    const s = stockState(m.totalQty, m.minStock).tone;
    if (sp.status === "ok") return s === "green";
    if (sp.status === "low") return s === "amber" || m.totalQty < m.minStock;
    if (sp.status === "out") return s === "red";
    return true;
  });
  const total = filtered.length;
  const materials = filtered.slice((page - 1) * size, page * size);
  const params = { q: sp.q, type: sp.type, status: sp.status, size: sp.size };
  const binNames = bins.map((b) => b.name);

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Danh mục Vật tư & Thành phẩm" />
      <PageBody>
        <Card className="p-4 flex flex-wrap items-center gap-4">
          <SearchBox placeholder="Tìm kiếm theo mã SKU, tên vật tư..." value={sp.q} className="flex-1 min-w-[320px] [&_input]:h-[60px] [&_input]:text-[18px]" />
          <RangeSelect param="type" value={sp.type} placeholder="Tất cả loại" className="h-[60px] min-w-[200px] text-[18px]" options={Object.entries(MATERIAL_TYPE).map(([v, t]) => ({ value: v, label: t.label }))} />
          <RangeSelect param="status" value={sp.status} placeholder="Tất cả trạng thái" className="h-[60px] min-w-[260px] text-[18px]" options={[{ value: "ok", label: "Đủ hàng" }, { value: "low", label: "Sắp hết / dưới định mức" }, { value: "out", label: "Hết hàng" }]} />
          <MaterialEditor bins={binNames} />
        </Card>
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr className="[&>th]:text-[17px]">
                <th className={TH + " w-16 text-center"}><input type="checkbox" className="w-5 h-5" aria-label="Chọn tất cả" /></th>
                <th className={TH}>Mã SKU / Ảnh</th>
                <th className={TH}>Tên vật tư / SP</th>
                <th className={TH + " text-center"}>Loại hàng</th>
                <th className={TH + " text-center leading-tight"}>Đơn vị tính<br />(ĐVT)</th>
                <th className={TH + " text-center"}>Vị trí kệ (Bin)</th>
                <th className={TH + " text-center leading-tight"}>Tồn kho thực tế<br />(Định mức tối thiểu)</th>
                <th className={TH + " text-center"}>Trạng thái</th>
                <th className={TH + " text-center"}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[18px] text-[#1E293B]">
              {materials.map((m) => {
                const st = stockState(m.totalQty, m.minStock);
                const t = MATERIAL_TYPE[m.type];
                const value = { id: m.id, sku: m.sku, name: m.name, type: m.type, unit: m.unit, locationBin: m.locationBin ?? "", minStock: m.minStock, costPrice: Number(m.costPrice), imageUrl: m.imageUrl ?? "" };
                return (
                  <tr key={m.id}>
                    <td className={TD + " text-center"}><input type="checkbox" className="w-5 h-5" aria-label={`Chọn ${m.sku}`} /></td>
                    <td className={TD} colSpan={2}>
                      <span className="flex items-center gap-4">
                        <Thumb src={m.imageUrl} alt={m.name} size={64} />
                        <span>
                          <span className="block font-bold">{m.sku}</span>
                          <span className="block">{m.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className={TD + " text-center"}><span className={`px-4 py-1.5 rounded-xl text-[16px] font-medium ${t.cls}`}>{t.label}</span></td>
                    <td className={TD + " text-center"}>{m.unit}</td>
                    <td className={TD + " text-center"}>{m.locationBin}</td>
                    <td className={TD + " text-center"}>
                      <div className="font-bold">{m.totalQty.toLocaleString("vi-VN")}</div>
                      <div className="text-[16px] text-slate-500">(Tối thiểu: {m.minStock})</div>
                    </td>
                    <td className={TD + " text-center"}><Pill label={st.label} tone={st.tone} className="text-[16px] px-4 py-1.5" /></td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-2.5">
                        <MaterialEditor bins={binNames} material={{ ...value, totalQty: m.totalQty, barcode: m.barcode }} mode="view" />
                        <MaterialEditor bins={binNames} material={value} />
                        <HistoryButton item={{ materialId: m.id }} name={m.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {materials.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">Không có vật tư phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-[18px] text-[#1E293B]">
              Hiển thị {total ? (page - 1) * size + 1 : 0} - {Math.min(page * size, total)} trong {total} mục
            </span>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / size))} hrefFor={(p) => withParams("/warehouse/items", params, { page: p })} />
          </div>
        </Card>
      </PageBody>
    </div>
  );
}
