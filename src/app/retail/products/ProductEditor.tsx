"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Boxes } from "lucide-react";
import { Modal, field, labelCls, btnPrimary, btnGhost } from "@/components/ui/Modal";
import { saveRetailProductAction } from "@/app/actions/catalog";
import { cn } from "@/components/ui/common";

export interface RetailProductValue {
  id?: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  costPrice: number;
  price: number;
  discountPercent: number;
  imageUrl: string;
}

export function ProductEditor({
  categories, product, buttonClass, iconOnly,
}: { categories: { id: string; name: string }[]; product?: RetailProductValue; buttonClass?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty: RetailProductValue = { code: "", name: "", description: "", categoryId: categories[0]?.id ?? "", costPrice: 0, price: 0, discountPercent: 0, imageUrl: "" };
  const [f, setF] = useState<RetailProductValue>(product ?? empty);
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [minStock, setMinStock] = useState(5);
  const [pending, start] = useTransition();
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const combos = Math.max(1, split(colors).length) * Math.max(1, split(sizes).length);

  return (
    <>
      {product ? (
        <button onClick={() => { setF(product); setOpen(true); }} className={buttonClass ?? "w-11 h-11 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center hover:bg-blue-100"} title="Sửa">
          <Pencil className="w-5 h-5" fill="currentColor" />
        </button>
      ) : (
        <button onClick={() => { setF(empty); setColors(""); setSizes(""); setOpen(true); }} className={cn("inline-flex items-center gap-2.5 h-14 px-7 rounded-xl bg-[#1565F5] hover:bg-[#0F55D8] text-white font-semibold text-[19px]", buttonClass)}>
          <Plus className="w-6 h-6" /> {iconOnly ? "" : "Thêm sản phẩm"}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={product ? "Sửa sản phẩm" : "Thêm sản phẩm & biến thể"} icon={<Boxes className="w-7 h-7 text-[#1565F5]" />} width="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveRetailProductAction({ ...f, id: product?.id, colors: split(colors), sizes: split(sizes), minStock });
              if ("error" in res) return void toast.error(res.error);
              toast.success(product ? "Đã cập nhật sản phẩm" : `Đã thêm sản phẩm với ${combos} biến thể`);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Mã sản phẩm *</label>
              <input className={field} placeholder="SP-AT08" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Tên sản phẩm *</label>
              <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Mô tả ngắn</label>
              <input className={field} placeholder="Cotton 100%, form rộng" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Loại hàng</label>
              <select className={field} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Giá vốn (đ)</label>
              <input type="number" min={0} step={1000} className={field} value={f.costPrice || ""} onChange={(e) => setF({ ...f, costPrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Giá bán (đ) *</label>
              <input type="number" min={0} step={1000} className={field} value={f.price || ""} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} required />
            </div>
            <div>
              <label className={labelCls}>Voucher khuyến mãi</label>
              <select className={field} value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: Number(e.target.value) })}>
                {[0, 5, 10, 15, 20].map((v) => (
                  <option key={v} value={v}>{v === 0 ? "Không áp dụng" : `Giảm ${v}%`}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Ảnh (emoji hoặc URL ảnh)</label>
            <input className={field} placeholder="👕 hoặc https://..." value={f.imageUrl.replace(/^emoji:/, "")} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
          </div>
          {!product && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
              <div className="font-semibold text-[#1E293B]">Biến thể (sinh tự động Màu × Size)</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Màu (phân cách bằng dấu phẩy)</label>
                  <input className={field} placeholder="Trắng, Đen, Xám" value={colors} onChange={(e) => setColors(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Size</label>
                  <input className={field} placeholder="M, L, XL" value={sizes} onChange={(e) => setSizes(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Định mức tối thiểu / biến thể</label>
                  <input type="number" min={0} className={field} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
                </div>
              </div>
              <div className="text-sm text-slate-500">Sẽ tạo {combos} biến thể, mỗi biến thể có SKU + mã vạch riêng. Tồn kho nhập qua phiếu Nhập hàng.</div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Hủy</button>
            <button disabled={pending} className={btnPrimary}>{pending ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
