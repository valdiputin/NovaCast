"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Box, Building2, CalendarDays, FileText, Save, Check, Printer, XCircle } from "lucide-react";
import { DocPanel, FieldBox, panelInput } from "./DocPanel";
import { LinesEditor, ScanBox, addOrIncrement, lineTotal, newKey, type CatalogItem, type DocLine } from "./LinesEditor";
import { saveReceiptAction, cancelReceiptAction } from "@/app/actions/docs";
import { Pill } from "../ui/kit";
import { DOC_STATUS, RECEIPT_TYPE } from "@/lib/labels";

export interface ReceiptDraft {
  id?: string;
  code?: string;
  status?: "DRAFT" | "APPROVED" | "CANCELLED";
  supplierId: string;
  receiptType: string;
  date: string; // yyyy-MM-ddTHH:mm (giờ VN)
  note: string;
  lines: DocLine[];
}

/** Panel "Tạo phiếu nhập hàng" — bán lẻ (biến thể) và kho doanh nghiệp (vật tư + vị trí kệ) */
export function ReceiptPanel({
  mode, catalog, suppliers, locations, initial, closeHref, title,
}: {
  mode: "retail" | "warehouse";
  catalog: CatalogItem[];
  suppliers: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  initial: ReceiptDraft;
  closeHref: string;
  title: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<ReceiptDraft>(initial.lines.length ? initial : { ...initial, lines: [{ key: newKey(), itemId: "", qty: 1, price: 0, discount: 0 }] });
  const [pending, start] = useTransition();
  const readOnly = !!d.status && d.status !== "DRAFT";
  const total = d.lines.filter((l) => l.itemId).reduce((s, l) => s + lineTotal(l), 0);
  const isRetail = mode === "retail";

  const submit = (approve: boolean) =>
    start(async () => {
      const lines = d.lines.filter((l) => l.itemId);
      const res = await saveReceiptAction({
        id: d.id,
        supplierId: d.supplierId,
        receiptType: d.receiptType as "SUPPLIER",
        receiptDate: new Date(d.date + ":00+07:00").toISOString(),
        note: d.note,
        approve,
        items: lines.map((l) => ({
          ...(isRetail ? { variantId: l.itemId } : { materialId: l.itemId }),
          locationId: l.locationId || undefined,
          quantity: l.qty,
          unitCost: l.price,
          discountRate: l.discount,
        })),
      });
      if ("error" in res) return void toast.error(res.error);
      toast.success(approve ? `Đã hoàn thành nhập kho — phiếu ${res.code}` : `Đã lưu tạm phiếu ${res.code} (chưa cộng tồn)`);
      router.push(closeHref, { scroll: false });
      router.refresh();
    });

  const act = (fn: () => Promise<{ success: true } | { error: string }>, ok: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const res = await fn();
      if ("error" in res) return void toast.error(res.error);
      toast.success(ok);
      router.push(closeHref, { scroll: false });
      router.refresh();
    });
  };

  return (
    <DocPanel
      title={d.code ? `${title} ${d.code}` : title}
      icon={<Box className="w-8 h-8" />}
      closeHref={closeHref}
      badge={d.status ? <Pill label={DOC_STATUS[d.status].label} tone={DOC_STATUS[d.status].tone} className="ml-2 bg-white" /> : null}
      footer={
        <>
          <div className="mr-auto" />
          <div className="text-[22px] font-bold text-[#1E293B] mr-4">
            Tổng tiền hàng: <span className="underline decoration-1 underline-offset-4">{total.toLocaleString("vi-VN")} ₫</span>
          </div>
          {d.id && (
            <Link href={`/print/receipt/${d.id}`} target="_blank" className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-slate-200 text-[17px] font-semibold text-[#1E293B] hover:bg-slate-50">
              <Printer className="w-5 h-5" /> In phiếu
            </Link>
          )}
          {d.id && d.status !== "CANCELLED" && (
            <button disabled={pending} onClick={() => act(() => cancelReceiptAction(d.id!), "Đã hủy phiếu nhập", d.status === "APPROVED" ? "Hủy phiếu đã duyệt sẽ trừ lại tồn kho đã nhập. Tiếp tục?" : "Hủy phiếu nháp này?")} className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-rose-200 text-[17px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <XCircle className="w-5 h-5" /> Hủy phiếu
            </button>
          )}
          {!readOnly && (
            <>
              <button disabled={pending} onClick={() => submit(false)} className="inline-flex items-center gap-2.5 h-14 px-6 rounded-xl border border-blue-200 bg-blue-50/60 text-[18px] font-semibold text-[#1565F5] hover:bg-blue-50 disabled:opacity-50">
                <Save className="w-6 h-6" /> {isRetail ? "Lưu tạm (Hàng đang về)" : "Lưu nháp"}
              </button>
              <button disabled={pending} onClick={() => submit(true)} className="inline-flex items-center gap-2.5 h-14 px-7 rounded-xl bg-[#1565F5] text-white text-[18px] font-semibold hover:bg-[#0F55D8] disabled:opacity-50">
                <Check className="w-6 h-6" /> {d.id ? "Duyệt & nhập kho" : "Hoàn thành nhập kho"}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.8fr_1.1fr_1fr] gap-4 items-end">
        <FieldBox label="Nhà cung cấp" required icon={<Building2 className="w-5 h-5" />}>
          <select disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.supplierId} onChange={(e) => setD({ ...d, supplierId: e.target.value })}>
            <option value="">— Chọn nhà cung cấp —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label="Ngày nhập" icon={<CalendarDays className="w-5 h-5" />}>
          <input type="datetime-local" disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </FieldBox>
        {isRetail ? (
          <FieldBox label="Ghi chú" icon={<FileText className="w-5 h-5" />}>
            <input disabled={readOnly} className={panelInput + " pl-12 pr-3"} placeholder="Nhập ghi chú (nếu có)..." value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </FieldBox>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FieldBox label="Loại phiếu">
              <select disabled={readOnly} className={panelInput + " px-3"} value={d.receiptType} onChange={(e) => setD({ ...d, receiptType: e.target.value })}>
                {Object.entries(RECEIPT_TYPE).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FieldBox>
            <FieldBox label="Ghi chú">
              <input disabled={readOnly} className={panelInput + " px-3"} placeholder="Ghi chú..." value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
            </FieldBox>
          </div>
        )}
        <ScanBox catalog={catalog} disabled={readOnly} onPick={(it) => setD((s) => ({ ...s, lines: addOrIncrement(s.lines, it) }))} />
      </div>
      <LinesEditor
        catalog={catalog}
        lines={d.lines}
        onChange={(lines) => setD({ ...d, lines })}
        readOnly={readOnly}
        cols={{
          qtyLabel: "Số lượng nhập *",
          priceLabel: "Giá nhập (VNĐ) *",
          discount: true,
          location: !isRetail && locations ? { label: "Vị trí kệ", options: locations } : undefined,
        }}
      />
    </DocPanel>
  );
}
