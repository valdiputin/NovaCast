"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, ConciergeBell } from "lucide-react";
import { Modal, field, labelCls, btnPrimary, btnRed, btnGhost } from "@/components/ui/Modal";
import { saveDishAction } from "@/app/actions/catalog";

export interface DishValue {
  id?: string;
  name: string;
  categoryId: string;
  basePrice: number;
  isCombo: boolean;
  isFeatured: boolean;
  status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
  imageUrl: string;
}

export function DishEditor({ categories, dish }: { categories: { id: string; name: string }[]; dish?: DishValue }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty: DishValue = { name: "", categoryId: categories[0]?.id ?? "", basePrice: 0, isCombo: false, isFeatured: false, status: "ACTIVE", imageUrl: "" };
  const [f, setF] = useState<DishValue>(dish ?? empty);
  const [pending, start] = useTransition();

  return (
    <>
      {dish ? (
        <button onClick={() => { setF(dish); setOpen(true); }} className="p-2 text-[#1565F5] hover:bg-blue-50 rounded-lg" title="Sửa">
          <Pencil className="w-6 h-6" fill="currentColor" />
        </button>
      ) : (
        <button onClick={() => { setF(empty); setOpen(true); }} className={btnRed + " h-14 px-7 text-[18px]"}>
          <Plus className="w-6 h-6" /> Thêm sản phẩm
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={dish ? "Sửa món" : "Thêm món mới"} icon={<ConciergeBell className="w-7 h-7 text-[#1565F5]" />}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveDishAction({ ...f, id: dish?.id });
              if ("error" in res) return void toast.error(res.error);
              toast.success(dish ? "Đã cập nhật món" : "Đã thêm món mới");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div>
            <label className={labelCls}>Tên món *</label>
            <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Danh mục *</label>
              <select className={field} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Giá gốc (đ) *</label>
              <input type="number" min={0} step={1000} className={field} value={f.basePrice || ""} onChange={(e) => setF({ ...f, basePrice: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Trạng thái</label>
              <select className={field} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as DishValue["status"] })}>
                <option value="ACTIVE">Đang bán</option>
                <option value="OUT_OF_STOCK">Hết hàng</option>
                <option value="INACTIVE">Ngừng bán</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Ảnh (emoji hoặc URL ảnh)</label>
              <input className={field} placeholder="🍗 hoặc https://..." value={f.imageUrl.replace(/^emoji:/, "")} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-6 text-[15px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.isCombo} onChange={(e) => setF({ ...f, isCombo: e.target.checked })} /> Là combo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.isFeatured} onChange={(e) => setF({ ...f, isFeatured: e.target.checked })} /> Món nổi bật ⭐</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Hủy</button>
            <button disabled={pending} className={btnPrimary}>{pending ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
