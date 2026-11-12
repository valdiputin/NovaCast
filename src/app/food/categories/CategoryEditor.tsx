"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Box } from "lucide-react";
import { Modal, field, labelCls, btnPrimary, btnRed, btnGhost } from "@/components/ui/Modal";
import { saveCategoryAction } from "@/app/actions/catalog";

type Cat = { id?: string; name: string; stockQty: number; minStock: number };

export function CategoryEditor({ category }: { category?: Cat }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const empty: Cat = { name: "", stockQty: 0, minStock: 20 };
  const [f, setF] = useState<Cat>(category ?? empty);
  const [pending, start] = useTransition();
  return (
    <>
      {category ? (
        <button onClick={() => { setF(category); setOpen(true); }} className="p-2 text-[#1565F5] hover:bg-blue-50 rounded-lg" title="Sửa">
          <Pencil className="w-6 h-6" fill="currentColor" />
        </button>
      ) : (
        <button onClick={() => { setF(empty); setOpen(true); }} className={btnRed + " h-14 px-7 text-[18px]"}>
          <Plus className="w-6 h-6" /> Thêm danh mục
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={category ? "Sửa danh mục" : "Thêm danh mục"} icon={<Box className="w-7 h-7 text-[#1565F5]" />}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveCategoryAction({ ...f, id: category?.id });
              if ("error" in res) return void toast.error(res.error);
              toast.success(category ? "Đã cập nhật danh mục" : "Đã thêm danh mục");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div>
            <label className={labelCls}>Tên danh mục *</label>
            <input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Số lượng</label>
              <input type="number" min={0} className={field} value={f.stockQty} onChange={(e) => setF({ ...f, stockQty: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Định mức (≤ → Sắp hết hàng)</label>
              <input type="number" min={0} className={field} value={f.minStock} onChange={(e) => setF({ ...f, minStock: Number(e.target.value) })} />
            </div>
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
