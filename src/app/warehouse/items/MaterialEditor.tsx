"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Boxes, Eye } from "lucide-react";
import { Modal, field, labelCls, btnPrimary, btnGhost } from "@/components/ui/Modal";
import { saveMaterialAction } from "@/app/actions/catalog";
import { MATERIAL_TYPE } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { Thumb } from "@/components/ui/Thumb";

export interface MaterialValue {
  id?: string;
  sku: string;
  name: string;
  type: "RAW_MATERIAL" | "SEMI_FINISHED" | "FINISHED_PRODUCT";
  unit: string;
  locationBin: string;
  minStock: number;
  costPrice: number;
  imageUrl: string;
}

export function MaterialEditor({ material, bins, mode = "edit" }: { material?: MaterialValue & { totalQty?: number; barcode?: string | null }; bins: string[]; mode?: "edit" | "view" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty: MaterialValue = { sku: "", name: "", type: "RAW_MATERIAL", unit: "Cái", locationBin: bins[0] ?? "Kệ A1 - Tầng 1", minStock: 10, costPrice: 0, imageUrl: "" };
  const [f, setF] = useState<MaterialValue>(material ?? empty);
  const [pending, start] = useTransition();
  const view = mode === "view";

  return (
    <>
      {material ? (
        <button onClick={() => { setF(material); setOpen(true); }} className="w-11 h-11 rounded-xl bg-blue-50 text-[#1565F5] inline-flex items-center justify-center hover:bg-blue-100" title={view ? "Xem chi tiết" : "Sửa"}>
          {view ? <Eye className="w-6 h-6" /> : <Pencil className="w-5 h-5" fill="currentColor" />}
        </button>
      ) : (
        <button onClick={() => { setF(empty); setOpen(true); }} className="inline-flex items-center gap-2.5 h-[60px] px-7 rounded-xl bg-[#1565F5] text-white text-[19px] font-semibold hover:bg-[#0F55D8]">
          <Plus className="w-6 h-6" /> Thêm mới
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={view ? f.name : material ? "Sửa vật tư / thành phẩm" : "Thêm vật tư / thành phẩm"} icon={<Boxes className="w-7 h-7 text-[#1565F5]" />} width="max-w-2xl">
        {view ? (
          <div className="flex gap-5">
            <Thumb src={f.imageUrl} alt={f.name} size={110} />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[16px]">
              <dt className="text-slate-500">Mã SKU</dt><dd className="font-semibold">{f.sku}</dd>
              <dt className="text-slate-500">Mã vạch</dt><dd>{material?.barcode ?? "—"}</dd>
              <dt className="text-slate-500">Loại hàng</dt><dd>{MATERIAL_TYPE[f.type].label}</dd>
              <dt className="text-slate-500">Đơn vị tính</dt><dd>{f.unit}</dd>
              <dt className="text-slate-500">Vị trí kệ</dt><dd>{f.locationBin}</dd>
              <dt className="text-slate-500">Tồn kho</dt><dd className="font-semibold">{material?.totalQty ?? 0} {f.unit}</dd>
              <dt className="text-slate-500">Định mức tối thiểu</dt><dd>{f.minStock}</dd>
              <dt className="text-slate-500">Giá vốn bình quân</dt><dd>{formatCurrency(f.costPrice)}</dd>
            </dl>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveMaterialAction({ ...f, id: material?.id });
                if ("error" in res) return void toast.error(res.error);
                toast.success(material ? "Đã cập nhật vật tư" : "Đã thêm vật tư mới");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Mã SKU *</label>
                <input className={field} value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} required />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Tên vật tư / sản phẩm *</label>
                <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Loại hàng</label>
                <select className={field} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MaterialValue["type"] })}>
                  {Object.entries(MATERIAL_TYPE).map(([v, t]) => (
                    <option key={v} value={v}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Đơn vị tính *</label>
                <input className={field} list="units" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} required />
                <datalist id="units">{["Cái", "Cuộn", "Kg", "Thùng", "Tấm", "Bao", "Cây", "Hộp"].map((u) => <option key={u} value={u} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Vị trí kệ (Bin) *</label>
                <input className={field} list="bins" value={f.locationBin} onChange={(e) => setF({ ...f, locationBin: e.target.value })} required />
                <datalist id="bins">{bins.map((b) => <option key={b} value={b} />)}</datalist>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Định mức tối thiểu</label>
                <input type="number" min={0} className={field} value={f.minStock} onChange={(e) => setF({ ...f, minStock: Number(e.target.value) })} />
              </div>
              {!material && (
                <div>
                  <label className={labelCls}>Giá vốn ban đầu (đ)</label>
                  <input type="number" min={0} step={1000} className={field} value={f.costPrice || ""} onChange={(e) => setF({ ...f, costPrice: Number(e.target.value) })} />
                </div>
              )}
              <div>
                <label className={labelCls}>Ảnh (emoji / URL)</label>
                <input className={field} value={f.imageUrl.replace(/^emoji:/, "")} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
              </div>
            </div>
            <p className="text-sm text-slate-500">Tồn kho chỉ thay đổi qua phiếu Nhập kho / Xuất kho / Kiểm kê.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Hủy</button>
              <button disabled={pending} className={btnPrimary}>{pending ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
