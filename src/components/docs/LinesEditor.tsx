"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Thumb } from "../ui/Thumb";
import { cn } from "../ui/common";

export interface CatalogItem {
  id: string;
  code: string; // SKU
  barcode?: string | null;
  name: string;
  img?: string | null;
  price: number; // giá gợi ý (giá nhập / giá bán / giá vốn)
  unit?: string;
  defaultLocationId?: string;
  stockByLoc?: Record<string, number>;
}

export interface DocLine {
  key: string;
  itemId: string;
  qty: number;
  price: number;
  discount: number;
  locationId?: string;
}

export interface LineCols {
  qtyLabel: string;
  priceLabel: string;
  discount?: boolean;
  location?: { label: string; options: { id: string; name: string }[] };
  showStock?: boolean; // hiện tồn tại vị trí (xuất / chuyển)
  codeFirst?: boolean; // cột "Mã hàng" riêng (phiếu trả hàng)
}

const num = "w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-right text-[17px] focus:outline-none focus:border-blue-500 disabled:bg-slate-50";
const fmt = (n: number) => n.toLocaleString("vi-VN");
export const lineTotal = (l: DocLine) => Math.round(l.qty * l.price * (1 - (l.discount || 0) / 100));
let seq = 0;
export const newKey = () => `l${Date.now()}${seq++}`;

/** Ô "Quét mã vạch liên tục để thêm sản phẩm" — nhận máy quét USB (gõ mã + Enter) */
export function ScanBox({ catalog, onPick, disabled }: { catalog: CatalogItem[]; onPick: (item: CatalogItem) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [v, setV] = useState("");
  return (
    <label className={cn("flex items-center gap-4 h-full min-h-[76px] px-5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 cursor-text", disabled && "opacity-50")} onClick={() => ref.current?.focus()}>
      <span className="w-14 h-14 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0">
        <ScanBarcode className="w-8 h-8 text-[#1565F5]" />
      </span>
      <span className="flex-1">
        <span className="block text-center text-[17px] font-semibold text-[#1565F5] leading-snug">Quét mã vạch liên tục<br />để thêm sản phẩm</span>
        <input
          ref={ref}
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const code = v.trim().toLowerCase();
            setV("");
            if (!code) return;
            const item = catalog.find((c) => c.code.toLowerCase() === code || c.barcode?.toLowerCase() === code);
            if (!item) return void toast.error(`Không tìm thấy mã: ${code}`);
            onPick(item);
          }}
          placeholder="Nhập / quét mã rồi Enter"
          className="w-full mt-1 bg-transparent text-center text-sm outline-none placeholder:text-blue-300"
        />
      </span>
    </label>
  );
}

export function addOrIncrement(lines: DocLine[], item: CatalogItem): DocLine[] {
  const i = lines.findIndex((l) => l.itemId === item.id);
  if (i >= 0) {
    toast.success(`Đã tăng số lượng ${item.code} lên ${lines[i].qty + 1}`);
    return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  }
  toast.success(`Đã thêm ${item.code}`);
  return [...lines.filter((l) => l.itemId), { key: newKey(), itemId: item.id, qty: 1, price: item.price, discount: 0, locationId: item.defaultLocationId }];
}

export function LinesEditor({
  catalog, lines, onChange, cols, readOnly,
}: { catalog: CatalogItem[]; lines: DocLine[]; onChange: (l: DocLine[]) => void; cols: LineCols; readOnly?: boolean }) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const set = (key: string, patch: Partial<DocLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const th = "px-3 py-3.5 text-[16px] font-semibold text-[#1E293B] text-left whitespace-nowrap";

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#F1F5FD]">
          <tr>
            <th className={th + " w-12 text-center"}>#</th>
            {cols.codeFirst && <th className={th}>Mã hàng</th>}
            <th className={th}>Tên sản phẩm</th>
            {cols.location && <th className={th}>{cols.location.label}</th>}
            {cols.showStock && <th className={th + " text-right"}>Tồn</th>}
            <th className={th + " text-center"}>{cols.qtyLabel}</th>
            <th className={th + " text-center"}>{cols.priceLabel}</th>
            {cols.discount && <th className={th + " text-center"}>Chiết khấu NCC (%)</th>}
            <th className={th + " text-right"}>Thành tiền (VNĐ)</th>
            {!readOnly && <th className={th + " text-center w-24"}>Thao tác</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l, i) => {
            const item = byId.get(l.itemId);
            const stock = item && l.locationId ? item.stockByLoc?.[l.locationId] ?? 0 : undefined;
            return (
              <tr key={l.key}>
                <td className="px-3 py-2.5 text-center text-[17px] font-semibold">{i + 1}</td>
                {cols.codeFirst && (
                  <td className="px-3 py-2.5">
                    {item && (
                      <span className="flex items-center gap-3">
                        <Thumb src={item.img} alt={item.name} size={44} />
                        <span className="text-[#1565F5] font-medium text-[16px]">{item.code}</span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5 min-w-[240px]">
                  {item ? (
                    cols.codeFirst ? (
                      <span className="text-[#1565F5] text-[16px]">{item.name}</span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <Thumb src={item.img} alt={item.name} size={44} />
                        <span>
                          <span className="block text-[17px] text-[#1E293B]">{item.name}</span>
                          <span className="block text-sm text-slate-500">SKU: {item.code}</span>
                        </span>
                      </span>
                    )
                  ) : (
                    <select
                      className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-[15px]"
                      value=""
                      onChange={(e) => {
                        const it = byId.get(e.target.value);
                        if (!it) return;
                        if (lines.some((x) => x.itemId === it.id && x.key !== l.key)) return void toast.error(`${it.code} đã có trong phiếu`);
                        set(l.key, { itemId: it.id, price: it.price, locationId: l.locationId ?? it.defaultLocationId });
                      }}
                    >
                      <option value="">— Chọn sản phẩm —</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                      ))}
                    </select>
                  )}
                </td>
                {cols.location && (
                  <td className="px-3 py-2.5 min-w-[170px]">
                    <select disabled={readOnly} className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-[15px] disabled:bg-slate-50" value={l.locationId ?? ""} onChange={(e) => set(l.key, { locationId: e.target.value })}>
                      <option value="">— Vị trí —</option>
                      {cols.location.options.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </td>
                )}
                {cols.showStock && <td className="px-3 py-2.5 text-right text-[16px] text-slate-600">{stock ?? "—"}{item?.unit ? ` ${item.unit}` : ""}</td>}
                <td className="px-3 py-2.5 w-36">
                  <input type="number" min={1} disabled={readOnly} className={num} value={l.qty || ""} onChange={(e) => set(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} />
                </td>
                <td className="px-3 py-2.5 w-44">
                  <input type="number" min={0} step={1000} disabled={readOnly} className={num} value={l.price || ""} onChange={(e) => set(l.key, { price: Math.max(0, Math.round(Number(e.target.value))) })} />
                </td>
                {cols.discount && (
                  <td className="px-3 py-2.5 w-40">
                    <div className="flex">
                      <input type="number" min={0} max={100} disabled={readOnly} className={num + " rounded-r-none"} value={l.discount} onChange={(e) => set(l.key, { discount: Math.min(100, Math.max(0, Number(e.target.value))) })} />
                      <span className="h-12 px-3 flex items-center rounded-r-xl border border-l-0 border-slate-200 bg-slate-50 text-[16px]">%</span>
                    </div>
                  </td>
                )}
                <td className="px-3 py-2.5 text-right text-[17px] font-semibold text-[#1E293B] whitespace-nowrap">{fmt(lineTotal(l))}</td>
                {!readOnly && (
                  <td className="px-3 py-2.5 text-center">
                    <button type="button" onClick={() => onChange(lines.filter((x) => x.key !== l.key))} className="w-10 h-10 rounded-lg bg-rose-50 text-[#E5252A] inline-flex items-center justify-center hover:bg-rose-100" title="Xóa dòng">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly && (
        <div className="px-3 py-3 border-t border-slate-100">
          <button type="button" onClick={() => onChange([...lines, { key: newKey(), itemId: "", qty: 1, price: 0, discount: 0 }])} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#EEF3FB] text-[#1E293B] font-semibold hover:bg-[#E2EAF7]">
            <Plus className="w-5 h-5" /> Thêm sản phẩm
          </button>
        </div>
      )}
    </div>
  );
}
