"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Undo2, AlertTriangle, ArrowLeftRight, User, CalendarDays, Save, Check, Printer, XCircle } from "lucide-react";
import { DocPanel, FieldBox, panelInput } from "./DocPanel";
import { LinesEditor, ScanBox, addOrIncrement, lineTotal, newKey, type CatalogItem, type DocLine } from "./LinesEditor";
import { saveSlipAction, cancelSlipAction } from "@/app/actions/docs";
import { Pill } from "../ui/kit";
import { SLIP_STATUS } from "@/lib/labels";

export type SlipKindName = "CUSTOMER_RETURN" | "DISPOSE" | "TRANSFER";

export interface SlipDraft {
  id?: string;
  code?: string;
  status?: "DRAFT" | "APPROVED" | "CANCELLED";
  kind: SlipKindName;
  partnerId: string;
  condition: "GOOD" | "DAMAGED";
  fromLocationId: string;
  toLocationId: string;
  date: string;
  note: string;
  lines: DocLine[];
}

const TITLE: Record<SlipKindName, [string, string]> = {
  CUSTOMER_RETURN: ["Tạo phiếu khách trả hàng", "Phiếu trả hàng"],
  DISPOSE: ["Tạo phiếu xuất hủy / hàng lỗi", "Phiếu xuất hủy"],
  TRANSFER: ["Tạo phiếu chuyển kho", "Phiếu chuyển kho"],
};

export function SlipPanel({
  catalog, customers, locations, initial, closeHref,
}: {
  catalog: CatalogItem[];
  customers: { id: string; name: string }[];
  locations: { id: string; name: string; kind: string }[];
  initial: SlipDraft;
  closeHref: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<SlipDraft>(initial.lines.length ? initial : { ...initial, lines: [{ key: newKey(), itemId: "", qty: 1, price: 0, discount: 0 }] });
  const [pending, start] = useTransition();
  const readOnly = !!d.status && d.status !== "DRAFT";
  const total = d.lines.filter((l) => l.itemId).reduce((s, l) => s + lineTotal(l), 0);
  const isReturn = d.kind === "CUSTOMER_RETURN";
  // Xuất hủy / chuyển kho: hiện tồn tại vị trí nguồn
  const withSource = (l: DocLine): DocLine => (isReturn ? l : { ...l, locationId: d.fromLocationId });

  const submit = (approve: boolean) =>
    start(async () => {
      const lines = d.lines.filter((l) => l.itemId);
      const res = await saveSlipAction({
        id: d.id,
        kind: d.kind,
        partnerId: isReturn ? d.partnerId || undefined : undefined,
        condition: isReturn ? d.condition : undefined,
        fromLocationId: isReturn ? undefined : d.fromLocationId,
        toLocationId: d.kind === "TRANSFER" ? d.toLocationId : undefined,
        slipDate: new Date(d.date + ":00+07:00").toISOString(),
        note: d.note,
        approve,
        items: lines.map((l) => ({ variantId: l.itemId, quantity: l.qty, unitPrice: l.price })),
      });
      if ("error" in res) return void toast.error(res.error);
      toast.success(approve ? `Đã hoàn thành phiếu ${res.code}` : `Đã lưu tạm phiếu ${res.code} (chờ duyệt)`);
      router.push(closeHref, { scroll: false });
      router.refresh();
    });

  const cancel = () => {
    if (!confirm(d.status === "APPROVED" ? "Hủy phiếu đã hoàn thành sẽ đảo ngược tồn kho. Tiếp tục?" : "Hủy phiếu này?")) return;
    start(async () => {
      const res = await cancelSlipAction(d.id!);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Đã hủy phiếu");
      router.push(closeHref, { scroll: false });
      router.refresh();
    });
  };

  const Icon = d.kind === "CUSTOMER_RETURN" ? Undo2 : d.kind === "DISPOSE" ? AlertTriangle : ArrowLeftRight;
  const sourceOpts = locations.filter((l) => (d.kind === "DISPOSE" ? true : l.kind !== "DAMAGED"));
  const targetOpts = locations.filter((l) => l.kind !== "DAMAGED" && l.id !== d.fromLocationId);

  return (
    <DocPanel
      title={d.code ? `${TITLE[d.kind][1]} ${d.code}` : TITLE[d.kind][0]}
      icon={<Icon className="w-8 h-8" />}
      closeHref={closeHref}
      badge={d.status ? <Pill label={SLIP_STATUS[d.status].label} tone={SLIP_STATUS[d.status].tone} className="ml-2 bg-white" /> : null}
      footer={
        <>
          <div className="mr-auto text-[19px] font-bold text-[#1E293B]">{isReturn ? `Giá trị hoàn: ${total.toLocaleString("vi-VN")} ₫` : null}</div>
          {d.id && (
            <Link href={`/print/slip/${d.id}`} target="_blank" className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-slate-200 text-[17px] font-semibold text-[#1E293B] hover:bg-slate-50">
              <Printer className="w-5 h-5" /> In phiếu
            </Link>
          )}
          {d.id && d.status !== "CANCELLED" && (
            <button disabled={pending} onClick={cancel} className="inline-flex items-center gap-2 h-14 px-5 rounded-xl border border-rose-200 text-[17px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <XCircle className="w-5 h-5" /> Hủy phiếu
            </button>
          )}
          {!readOnly && (
            <>
              <button disabled={pending} onClick={() => submit(false)} className="inline-flex items-center gap-2.5 h-14 px-6 rounded-xl border border-blue-200 bg-blue-50/60 text-[18px] font-semibold text-[#1565F5] hover:bg-blue-50 disabled:opacity-50">
                <Save className="w-6 h-6" /> Lưu tạm
              </button>
              <button disabled={pending} onClick={() => submit(true)} className="inline-flex items-center gap-2.5 h-14 px-7 rounded-xl bg-[#1565F5] text-white text-[18px] font-semibold hover:bg-[#0F55D8] disabled:opacity-50">
                <Check className="w-6 h-6" /> {isReturn ? "Hoàn thành trả hàng" : d.kind === "DISPOSE" ? "Hoàn thành xuất hủy" : "Hoàn thành chuyển kho"}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-end">
        {isReturn ? (
          <>
            <FieldBox label="Khách hàng" required icon={<User className="w-5 h-5" fill="currentColor" />}>
              <select disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.partnerId} onChange={(e) => setD({ ...d, partnerId: e.target.value })}>
                <option value="">— Chọn khách hàng —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FieldBox>
            <FieldBox label="Ngày trả hàng" icon={<CalendarDays className="w-5 h-5" />}>
              <input type="datetime-local" disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
            </FieldBox>
            <FieldBox label="Tình trạng hàng">
              <select disabled={readOnly} className={panelInput + " px-4"} value={d.condition} onChange={(e) => setD({ ...d, condition: e.target.value as "GOOD" | "DAMAGED" })}>
                <option value="GOOD">Hàng nguyên vẹn</option>
                <option value="DAMAGED">Hàng lỗi</option>
              </select>
            </FieldBox>
          </>
        ) : (
          <>
            <FieldBox label={d.kind === "DISPOSE" ? "Xuất hủy từ vị trí" : "Từ vị trí"} required>
              <select disabled={readOnly} className={panelInput + " px-4"} value={d.fromLocationId} onChange={(e) => setD({ ...d, fromLocationId: e.target.value, lines: d.lines.map((l) => ({ ...l, locationId: e.target.value })) })}>
                {sourceOpts.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </FieldBox>
            {d.kind === "TRANSFER" ? (
              <FieldBox label="Đến vị trí" required>
                <select disabled={readOnly} className={panelInput + " px-4"} value={d.toLocationId} onChange={(e) => setD({ ...d, toLocationId: e.target.value })}>
                  <option value="">— Chọn vị trí đích —</option>
                  {targetOpts.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </FieldBox>
            ) : (
              <FieldBox label="Ngày chứng từ" icon={<CalendarDays className="w-5 h-5" />}>
                <input type="datetime-local" disabled={readOnly} className={panelInput + " pl-12 pr-3"} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
              </FieldBox>
            )}
            <ScanBox catalog={catalog} disabled={readOnly} onPick={(it) => setD((s) => ({ ...s, lines: addOrIncrement(s.lines, it).map(withSource) }))} />
          </>
        )}
        <FieldBox label={d.kind === "DISPOSE" ? "Lý do / ghi chú" : "Ghi chú"}>
          <input disabled={readOnly} className={panelInput + " px-4"} placeholder="Nhập ghi chú (nếu có)..." value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </FieldBox>
      </div>
      <LinesEditor
        catalog={catalog}
        lines={d.lines.map(withSource)}
        onChange={(lines) => setD({ ...d, lines: lines.map(withSource) })}
        readOnly={readOnly}
        cols={{
          codeFirst: isReturn,
          qtyLabel: isReturn ? "Số lượng trả" : "Số lượng",
          priceLabel: isReturn ? "Đơn giá bán" : "Đơn giá vốn",
          showStock: !isReturn,
        }}
      />
    </DocPanel>
  );
}
