"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ScanBarcode, Trash2, Printer, Info, HelpCircle, ChevronsUpDown } from "lucide-react";
import { Thumb, BarcodeImg } from "@/components/ui/Thumb";
import { Pill, TD, TH } from "@/components/ui/kit";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProductEditor, type RetailProductValue } from "./ProductEditor";
import { deleteProductAction } from "@/app/actions/catalog";
import { formatCurrency } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { cn } from "@/components/ui/common";

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  img: string | null;
  barcodeSvg: string;
  variantSummary: string;
  cost: number;
  price: number;
  afterDiscount: number | null;
  total: number;
  shelf: number;
  warehouse: number;
  sold: number;
  status: { label: string; tone: Tone };
  edit: RetailProductValue;
  variants: { id: string; sku: string; name: string; barcode: string; shelf: number; warehouse: number; min: number; cost: number; status: { label: string; tone: Tone } }[];
}

/** Bảng "Sản phẩm & Biến thể": chọn nhiều để in tem, bấm ⌄ để xem từng biến thể */
export function ProductTable({ rows, categories, sortHref }: { rows: ProductRow[]; categories: { id: string; name: string }[]; sortHref: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const ids = rows.filter((r) => selected[r.id]).map((r) => r.id);
  const allChecked = rows.length > 0 && ids.length === rows.length;

  return (
    <table className="w-full">
      <thead className="bg-[#F1F5FD]">
        <tr>
          <th className={TH + " w-14 text-center"}>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300"
              aria-label="Chọn tất cả"
              checked={allChecked}
              onChange={(e) => setSelected(Object.fromEntries(rows.map((r) => [r.id, e.target.checked])))}
            />
          </th>
          <th className={TH + " text-[17px]"}>Ảnh &amp; Mã vạch</th>
          <th className={TH + " text-[17px]"}>
            <Link href={sortHref} className="inline-flex items-center gap-2">Tên sản phẩm <ChevronsUpDown className="w-4 h-4 text-slate-400" /></Link>
          </th>
          <th className={TH + " text-[17px]"}>Giá vốn / Giá bán <Info className="inline w-4 h-4 text-slate-400 -mt-0.5" /></th>
          <th className={TH + " text-[17px]"}>Tồn kho (Kệ / Kho)</th>
          <th className={TH + " text-[17px] text-center"}>Đã bán <HelpCircle className="inline w-4 h-4 text-slate-400 -mt-0.5" /></th>
          <th className={TH + " text-[17px] text-center"}>Trạng thái</th>
          <th className={TH + " text-[17px] text-center"}>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        {ids.length > 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-2.5 bg-blue-50 text-[15px]">
              <span className="font-semibold text-[#1E293B] mr-4">Đã chọn {ids.length} sản phẩm</span>
              <Link href={`/print/labels?ids=${ids.join(",")}`} target="_blank" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-[#1565F5] font-semibold">
                <Printer className="w-4 h-4" /> In tem mã vạch
              </Link>
              <button onClick={() => setSelected({})} className="ml-3 text-slate-500 hover:text-slate-800">Bỏ chọn</button>
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <Fragment key={r.id}>
            <tr className="border-t border-slate-100">
              <td className={TD + " text-center"}>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300" checked={!!selected[r.id]} onChange={(e) => setSelected({ ...selected, [r.id]: e.target.checked })} aria-label={`Chọn ${r.name}`} />
              </td>
              <td className={TD}>
                <div className="flex items-center gap-3">
                  <Thumb src={r.img} alt={r.name} size={74} />
                  <div className="w-[92px]">
                    <BarcodeImg svg={r.barcodeSvg} className="h-7 w-[86px]" />
                    <div className="text-[15px] text-[#1E293B] mt-1 text-center">{r.code}</div>
                  </div>
                </div>
              </td>
              <td className={TD}>
                <button className="flex items-center gap-3 text-left" onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })} title="Xem biến thể">
                  <span>
                    <span className="block text-[18px] font-semibold text-[#1E293B]">{r.name}</span>
                    <span className="block text-[15px] text-slate-500">({r.variantSummary})</span>
                  </span>
                  <ChevronDown className={cn("w-5 h-5 shrink-0 transition-transform", open[r.id] && "rotate-180")} />
                </button>
              </td>
              <td className={TD + " whitespace-nowrap"}>
                <div className="text-[15px] text-slate-500">Vốn: <span className="line-through">{formatCurrency(r.cost)}</span></div>
                <div className="text-[18px] font-bold text-[#1565F5]">Bán: {formatCurrency(r.price)}</div>
                {r.afterDiscount !== null && <div className="text-[13px] font-semibold text-emerald-600">Sau KM: {formatCurrency(r.afterDiscount)}</div>}
              </td>
              <td className={TD + " whitespace-nowrap"}>
                <div className="text-[18px] font-semibold text-[#1E293B]">Tổng: {r.total}</div>
                <div className="text-[15px] text-slate-500">(Kệ: {r.shelf} | Kho: {r.warehouse})</div>
              </td>
              <td className={TD + " text-center text-[18px] font-semibold text-[#1E293B]"}>{r.sold.toLocaleString("vi-VN")}</td>
              <td className={TD + " text-center"}><Pill label={r.status.label} tone={r.status.tone} className="text-[16px] px-4 py-2" /></td>
              <td className={TD}>
                <div className="flex items-center justify-center gap-2.5">
                  <Link href={`/print/labels?ids=${r.id}`} target="_blank" className="w-11 h-11 rounded-xl bg-blue-50 text-[#1565F5] flex items-center justify-center hover:bg-blue-100" title="In tem mã vạch">
                    <ScanBarcode className="w-6 h-6" />
                  </Link>
                  <ProductEditor categories={categories} product={r.edit} />
                  <ActionButton
                    action={deleteProductAction.bind(null, r.id)}
                    confirmText={`Xóa sản phẩm "${r.name}"? Nếu đã có giao dịch kho, sản phẩm sẽ chuyển sang "Ngừng bán".`}
                    successText="Đã xóa sản phẩm"
                    altSuccess={{ key: "deactivated", text: "Sản phẩm đã có giao dịch kho → chuyển sang Ngừng bán" }}
                    className="w-11 h-11 rounded-xl bg-rose-50 text-[#E5252A] flex items-center justify-center hover:bg-rose-100"
                    title="Xóa"
                  >
                    <Trash2 className="w-6 h-6" fill="currentColor" stroke="white" />
                  </ActionButton>
                </div>
              </td>
            </tr>
            {open[r.id] &&
              r.variants.map((v) => (
                <tr key={v.id} className="bg-slate-50/70 text-[15px]">
                  <td />
                  <td className={TD + " text-slate-500"}>
                    {v.sku}
                    <div className="text-xs text-slate-400">{v.barcode}</div>
                  </td>
                  <td className={TD + " text-[#1E293B]"}>↳ {v.name}</td>
                  <td className={TD + " text-slate-500"}>Vốn TB: {formatCurrency(v.cost)}</td>
                  <td className={TD}>Tổng: {v.shelf + v.warehouse} (Kệ: {v.shelf} | Kho: {v.warehouse}) · Tối thiểu {v.min}</td>
                  <td />
                  <td className={TD + " text-center"}><Pill label={v.status.label} tone={v.status.tone} /></td>
                  <td />
                </tr>
              ))}
          </Fragment>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="py-10 text-center text-slate-400">Không có sản phẩm phù hợp</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
