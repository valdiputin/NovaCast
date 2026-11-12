"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Upload, CalendarDays, Save, Check, Printer, XCircle, Factory } from "lucide-react";
import { DocPanel, FieldBox, panelInput } from "./DocPanel";
import { LinesEditor, ScanBox, addOrIncrement, lineTotal, newKey, type CatalogItem, type DocLine } from "./LinesEditor";
import { saveIssueAction, cancelIssueAction } from "@/app/actions/docs";
import { Pill } from "../ui/kit";
import { DOC_STATUS, ISSUE_FILTER } from "@/lib/labels";

export interface IssueDraft {
  id?: string;
  code?: string;
  status?: "DRAFT" | "APPROVED" | "CANCELLED";
  issueType: "PRODUCTION" | "CUSTOMER" | "DISPOSE";
  workshop: string;
  date: string;
  note: string;
  lines: DocLine[];
}

export function IssuePanel({ catalog, locations, initial, closeHref }: { catalog: CatalogItem[]; locations: { id: string; name: string }[]; initial: IssueDraft; closeHref: string }) {
  const router = useRouter();
  const [d, setD] = useState<IssueDraft>(initial.lines.length ? initial : { ...initial, lines: [{ key: newKey(), itemId: "", qty: 1, price: 0, discount: 0 }] });
  const [pending, start] = useTransition();
  const readOnly = !!d.status && d.status !== "DRAFT";
  const total = d.lines.filter((l) => l.itemId).reduce((s, l) => s + lineTotal(l), 0);

  const submit = (approve: boolean) =>
    start(async () => {
      const res = await saveIssueAction({
        id: d.id,
        issueType: d.issueType,
        workshop: d.workshop,
        issueDate: new Date(d.date + ":00+07:00").toISOString(),
        note: d.note,
        approve,
        items: d.lines.filter((l) => l.itemId).map((l) => ({ materialId: l.itemId, locationId: l.locationId || undefined, quantity: l.qty, unitCost: l.price })),
      });
      if ("error" in res) return void toast.error(res.error);
      toast.success(approve ? `Đã duyệt & xuất kho — phiếu ${res.code}` : `Đã lưu nháp phiếu ${res.code} (chưa trừ tồn)`);
      router.push(closeHref, { scroll: false });
      router.refresh();
    });

  const cancel = () => {
    if (!confirm(d.status === "APPROVED" ? "Hủy phiếu đã duyệt sẽ cộng trả lại tồn kho. Tiếp tục?" : "Hủy phiếu nháp này?")) return;
    start(async () => {
      const res = await cancelIssueAction(d.id!);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Đã hủy phiếu xuất");
      router.push(closeHref, { scroll: false });
      router.refresh();
    });
  };

  return (
    <DocPanel
      title={d.code ? `Phiếu xuất ${d.code}` : "Tạo phiếu xuất kho"}
      icon={<Upload className="w-8 h-8" />}
      closeHref={closeHref}
      badge={d.status ? <Pill label={DOC_STATUS[d.status].label} tone={DOC_STATUS[d.status].tone} className="ml-2 bg-white" /> : null}
      footer={
        <>
          <div className="mr-auto text-[20px] font-bold text-[#1E293B]">Tổng giá trị: {total.toLocaleString("vi-VN")} ₫</div>
          {d.id && (
            <Link href={`/print/issue/${d.id}`} target="_blank" className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-slate-200 text-[17px] font-semibold hover:bg-slate-50">
              <Printer className="w-5 h-5" /> In phiếu (PDF)
            </Link>
          )}
          {d.id && d.status !== "CANCELLED" && (
            <button disabled={pending} onClick={cancel} className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-rose-200 text-[17px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <XCircle className="w-5 h-5" /> Hủy phiếu
            </button>
          )}
          {!readOnly && (
            <>
              <button disabled={pending} onClick={() => submit(false)} className="inline-flex items-center gap-2.5 h-14 px-6 rounded-xl border border-blue-200 bg-blue-50/60 text-[18px] font-semibold text-[#1565F5] disabled:opacity-50">
                <Save className="w-6 h-6" /> Lưu nháp
              </button>
              <button disabled={pending} onClick={() => submit(true)} className="inline-flex items-center gap-2.5 h-14 px-7 rounded-xl bg-[#1565F5] text-white text-[18px] font-semibold disabled:opacity-50">
                <Check className="w-6 h-6" /> Duyệt & xuất kho
              </button>
            </>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-end">
        <FieldBox label="Loại phiếu" required>
          <select disabled={readOnly} className={panelInput + " px-4"} value={d.issueType} onChange={(e) => setD({ ...d, issueType: e.target.value as IssueDraft["issueType"], workshop: e.target.value === "CUSTOMER" ? "Giao khách hàng" : d.workshop === "Giao khách hàng" ? "Xưởng May 1" : d.workshop })}>
            {Object.entries(ISSUE_FILTER).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </FieldBox>
        <FieldBox label={d.issueType === "CUSTOMER" ? "Khách hàng / nơi nhận" : "Xưởng / nơi nhận"} required icon={<Factory className="w-5 h-5" />}>
          <input disabled={readOnly} list="workshops" className={panelInput + " pl-12 pr-3"} value={d.workshop} onChange={(e) => setD({ ...d, workshop: e.target.value })} />
          <datalist id="workshops">{["Xưởng May 1", "Xưởng May 2", "Giao khách hàng"].map((w) => <option key={w} value={w} />)}</datalist>
        </FieldBox>
        <FieldBox label="Ngày chứng từ" icon={<CalendarDays className="w-5 h-5" />}>
          <input type="datetime-local" disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </FieldBox>
        <ScanBox catalog={catalog} disabled={readOnly} onPick={(it) => setD((s) => ({ ...s, lines: addOrIncrement(s.lines, it) }))} />
      </div>
      <FieldBox label="Ghi chú">
        <input disabled={readOnly} className={panelInput + " px-4"} placeholder="Ghi chú..." value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
      </FieldBox>
      <LinesEditor
        catalog={catalog}
        lines={d.lines}
        onChange={(lines) => setD({ ...d, lines })}
        readOnly={readOnly}
        cols={{ qtyLabel: "Số lượng xuất *", priceLabel: "Đơn giá (VNĐ)", location: { label: "Vị trí xuất", options: locations }, showStock: true }}
      />
    </DocPanel>
  );
}
