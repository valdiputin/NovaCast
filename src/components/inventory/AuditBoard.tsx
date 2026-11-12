"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ClipboardList, Info, Plus, Save, Scale, ScanBarcode } from "lucide-react";
import { approveAuditAction, createAuditDraftAction, saveAuditCountsAction } from "@/app/actions/docs";
import { BarcodeImg, Thumb } from "../ui/Thumb";
import { HistoryButton } from "./HistoryButton";
import { cn } from "../ui/common";

export interface AuditRowView {
  itemId: string;
  sku: string;
  barcode?: string | null;
  barcodeSvg?: string;
  img?: string | null;
  name: string;
  unit?: string;
  locationName: string;
  systemQty: number;
  actualQty: number;
  reason: string;
  unitCost: number;
  ref: { variantId?: string; materialId?: string };
}

const fmt = (n: number) => n.toLocaleString("vi-VN");

/**
 * Bảng đối chiếu kiểm kê (bán lẻ & kho doanh nghiệp).
 * Phiên kiểm kê: tạo (chốt tồn hệ thống) → nhập số đếm (lưu nháp) → duyệt & cân bằng kho.
 */
export function AuditBoard({
  variant, audit, rows, filterOptions, filterLabel, autoRefresh,
}: {
  variant: "retail" | "warehouse";
  audit: { id: string; code: string } | null;
  rows: AuditRowView[];
  filterOptions: { value: string; label: string }[];
  filterLabel: string;
  autoRefresh?: boolean;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, { actual: string; reason: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.itemId, { actual: String(r.actualQty), reason: r.reason }]))
  );
  const [scan, setScan] = useState("");
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);

  // Đồng bộ số đếm từ màn quét điện thoại (khi chưa sửa tay trên máy tính)
  useEffect(() => {
    if (!dirty.current) setCounts(Object.fromEntries(rows.map((r) => [r.itemId, { actual: String(r.actualQty), reason: r.reason }])));
  }, [rows]);
  useEffect(() => {
    if (!autoRefresh || !audit) return;
    const t = setInterval(() => !dirty.current && router.refresh(), 5000);
    return () => clearInterval(t);
  }, [autoRefresh, audit, router]);

  const view = useMemo(
    () =>
      rows.map((r) => {
        const c = counts[r.itemId] ?? { actual: String(r.actualQty), reason: r.reason };
        const actual = c.actual === "" ? r.systemQty : Number(c.actual);
        const diff = actual - r.systemQty;
        return { ...r, actual, actualRaw: c.actual, reason: c.reason, diff, value: diff * r.unitCost };
      }),
    [rows, counts]
  );
  const totalDiff = view.reduce((s, r) => s + r.value, 0);

  const set = (id: string, patch: Partial<{ actual: string; reason: string }>) => {
    dirty.current = true;
    setCounts((c) => ({ ...c, [id]: { ...(c[id] ?? { actual: "", reason: "" }), ...patch } }));
  };

  const payload = () =>
    view.map((r) => ({
      itemId: r.itemId,
      actualQty: r.actual,
      reason: r.diff === 0 ? "" : r.reason || (variant === "retail" ? (r.diff > 0 ? "Thừa khi kiểm đếm" : "Thiếu khi kiểm đếm") : ""),
    }));

  const save = (approve: boolean) =>
    start(async () => {
      if (!audit) return;
      if (view.some((r) => !Number.isInteger(r.actual) || r.actual < 0)) return void toast.error("Số đếm phải là số nguyên ≥ 0");
      const res = await saveAuditCountsAction({ auditId: audit.id, items: payload() });
      if ("error" in res) return void toast.error(res.error);
      dirty.current = false;
      if (!approve) {
        toast.success("Đã lưu số đếm (nháp) — chưa thay đổi tồn kho");
        return router.refresh();
      }
      const ok = await approveAuditAction(audit.id);
      if ("error" in ok) return void toast.error(ok.error);
      toast.success(`Đã cân bằng kho: ${ok.adjusted} dòng chênh lệch`);
      router.refresh();
    });

  const create = (scope: string) =>
    start(async () => {
      setMenu(false);
      const res = await createAuditDraftAction(
        variant === "retail" ? { categoryId: scope || undefined } : { materialType: (scope || undefined) as "RAW_MATERIAL" | undefined }
      );
      if ("error" in res) return void toast.error(res.error);
      toast.success(`Đã tạo phiếu ${res.code} (${res.count} dòng) — tồn hệ thống đã được chốt`);
      dirty.current = false;
      router.refresh();
    });

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim().toLowerCase();
    setScan("");
    if (!code) return;
    const r = view.find((x) => x.sku.toLowerCase() === code || x.barcode?.toLowerCase() === code);
    if (!r) return void toast.error(`Mã ${code} không có trong phiếu kiểm kê`);
    set(r.itemId, { actual: String((counts[r.itemId]?.actual ? Number(counts[r.itemId].actual) : 0) + 1) });
    toast.success(`${r.name}: +1`);
  };

  const createBtn = (
    <div className="relative inline-flex">
      <button disabled={pending} onClick={() => create(filter)} className="inline-flex items-center gap-2.5 h-14 pl-6 pr-4 rounded-l-xl bg-[#1565F5] text-white text-[18px] font-semibold hover:bg-[#0F55D8] disabled:opacity-50">
        <Plus className="w-6 h-6" /> {variant === "retail" ? "Tạo phiếu kiểm kê" : "Tạo phiên kiểm kê mới"}
      </button>
      <button onClick={() => setMenu((m) => !m)} className="h-14 px-3 rounded-r-xl bg-[#1565F5] text-white border-l border-white/30 hover:bg-[#0F55D8]" aria-label="Chọn phạm vi kiểm kê">
        <ChevronDown className="w-5 h-5" />
      </button>
      {menu && (
        <div className="absolute top-[60px] left-0 z-20 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-1">
          <button onClick={() => create("")} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">Kiểm kê toàn bộ</button>
          {filterOptions.map((o) => (
            <button key={o.value} onClick={() => create(o.value)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
              Theo {filterLabel.toLowerCase()}: {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const th = "px-4 py-3.5 text-[16px] font-semibold text-[#1E293B] whitespace-nowrap";
  const pill = (d: number) => cn("inline-flex min-w-[64px] justify-center px-3 py-1 rounded-full text-[16px] font-semibold", d === 0 ? "bg-slate-100 text-slate-500" : d > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600");

  return (
    <div className="space-y-4">
      {variant === "retail" ? (
        <div className="flex flex-wrap items-center gap-3">
          {createBtn}
          <span className="text-[18px] font-semibold text-[#1E293B] ml-2">Kiểm kê theo:</span>
          <span className="inline-flex items-center h-14 px-4 rounded-xl border border-slate-200 bg-white text-[17px]">
            <ClipboardList className="w-5 h-5 mr-2" /> {filterLabel}
          </span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-14 px-4 rounded-xl border border-slate-200 bg-white text-[17px] min-w-[200px]">
            <option value="">Tất cả</option>
            {filterOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <form onSubmit={onScan} className="relative ml-auto">
            <ScanBarcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1565F5]" />
            <input value={scan} onChange={(e) => setScan(e.target.value)} disabled={!audit} placeholder="Quét mã vạch (+1)" className="h-14 w-60 pl-11 pr-3 rounded-xl border border-slate-200 bg-white text-[16px]" />
          </form>
        </div>
      ) : null}

      <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {variant === "warehouse" && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
            <h2 className="flex items-center gap-3 text-[24px] font-bold text-[#1E293B]">
              <ClipboardList className="w-8 h-8 text-[#1565F5]" /> Danh sách đối chiếu kiểm kê
              {audit && <span className="text-base font-semibold text-slate-400">· {audit.code}</span>}
            </h2>
            <div className="flex items-center gap-3">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-14 px-3 rounded-xl border border-slate-200 bg-white text-[16px]" title={filterLabel}>
                <option value="">Tất cả loại hàng</option>
                {filterOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {createBtn}
              <button disabled={pending || !audit} onClick={() => save(true)} className="inline-flex items-center gap-2.5 h-14 px-6 rounded-xl bg-[#EEF3FB] text-[#1E293B] text-[18px] font-semibold hover:bg-[#E2EAF7] disabled:opacity-50">
                <Scale className="w-6 h-6" /> Cân bằng kho
              </button>
            </div>
          </div>
        )}
        <table className="w-full">
          <thead className="bg-[#F1F5FD]">
            {variant === "retail" ? (
              <tr>
                <th className={th + " w-14 text-center"}>#</th>
                <th className={th}>Mã vạch</th>
                <th className={th}>Tên sản phẩm</th>
                <th className={th + " text-center"}>Tồn hệ thống</th>
                <th className={th + " text-center"}>Thực tế kiểm đếm</th>
                <th className={th + " text-center leading-tight"}>Chênh lệch<br />(Thừa/Thiếu)</th>
                <th className={th + " text-right"}>Giá trị chênh lệch</th>
                <th className={th + " text-center"}>Thao tác</th>
              </tr>
            ) : (
              <tr>
                <th className={th + " w-14 text-center"}><input type="checkbox" className="w-5 h-5" aria-label="Chọn tất cả" /></th>
                <th className={th}>Mã hàng</th>
                <th className={th} colSpan={2}>Tên hàng</th>
                <th className={th + " text-center"}>Tồn trên phần mềm</th>
                <th className={th + " text-center"}>Tồn thực tế đếm được</th>
                <th className={th + " text-center"}>Chênh lệch (+/-)</th>
                <th className={th}>Lý do chênh lệch</th>
                <th className={th + " text-center"}>Thao tác</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100 text-[17px] text-[#1E293B]">
            {!audit && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  Chưa có phiếu kiểm kê đang mở. Bấm “{variant === "retail" ? "Tạo phiếu kiểm kê" : "Tạo phiên kiểm kê mới"}” để chốt tồn hệ thống và bắt đầu kiểm đếm.
                </td>
              </tr>
            )}
            {view.map((r, i) =>
              variant === "retail" ? (
                <tr key={r.itemId}>
                  <td className="px-4 py-2.5 text-center font-semibold">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <Thumb src={r.img} alt={r.name} size={36} />
                      <BarcodeImg svg={r.barcodeSvg} className="h-7 w-[84px]" />
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 text-center">{fmt(r.systemQty)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input type="number" min={0} value={r.actualRaw} onChange={(e) => set(r.itemId, { actual: e.target.value })} className="w-32 h-12 rounded-xl border border-slate-200 text-center text-[18px]" />
                  </td>
                  <td className="px-4 py-2.5 text-center"><span className={pill(r.diff)}>{r.diff > 0 ? `+${r.diff}` : r.diff}</span></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{r.value > 0 ? "+" : ""}{fmt(r.value)} <u>đ</u></td>
                  <td className="px-4 py-2.5 text-center"><HistoryButton item={r.ref} name={r.name} icon="eye" /></td>
                </tr>
              ) : (
                <tr key={r.itemId}>
                  <td className="px-4 py-3 text-center"><input type="checkbox" className="w-5 h-5" aria-label={`Chọn ${r.sku}`} /></td>
                  <td className="px-4 py-3 font-semibold">{r.sku}</td>
                  <td className="pl-4 py-3 w-16"><Thumb src={r.img} alt={r.name} size={56} /></td>
                  <td className="pr-4 py-3">{r.name}{r.unit ? ` (${r.unit})` : ""}</td>
                  <td className="px-4 py-3 text-center">{fmt(r.systemQty)}</td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" min={0} value={r.actualRaw} onChange={(e) => set(r.itemId, { actual: e.target.value })} className="w-40 h-12 rounded-xl border border-slate-200 px-4 text-[18px]" />
                  </td>
                  <td className="px-4 py-3 text-center"><span className={pill(r.diff)}>{r.diff > 0 ? `+${r.diff}` : r.diff}</span></td>
                  <td className="px-4 py-3">
                    <input value={r.reason} onChange={(e) => set(r.itemId, { reason: e.target.value })} placeholder="Nhập lý do..." className="w-full min-w-[200px] h-12 rounded-xl border border-slate-200 px-4 text-[17px]" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <HistoryButton item={r.ref} name={r.name} icon="eye" />
                      <HistoryButton item={r.ref} name={r.name} />
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {variant === "warehouse" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <span className="text-[17px] text-[#1E293B]">Hiển thị 1 - {view.length} trong {view.length} mặt hàng</span>
            {audit && (
              <button disabled={pending} onClick={() => save(false)} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-[15px] font-semibold hover:bg-slate-50 disabled:opacity-50">
                <Save className="w-4 h-4" /> Lưu nháp số đếm
              </button>
            )}
          </div>
        )}
      </section>

      {variant === "retail" && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[360px] flex items-center gap-3 h-16 px-6 rounded-2xl bg-[#EEF3FB] text-[20px] font-bold text-[#1E293B]">
              <Info className="w-7 h-7 text-white" fill="#1565F5" />
              Tổng chênh lệch:
              <span className={cn("text-[26px] underline underline-offset-4 decoration-2", totalDiff < 0 ? "text-[#E5252A]" : "text-[#1E293B]")}>{fmt(totalDiff)} đ</span>
            </div>
            <button disabled={pending || !audit} onClick={() => save(false)} className="inline-flex items-center gap-2.5 h-16 px-6 rounded-2xl border border-slate-200 bg-white text-[18px] font-semibold hover:bg-slate-50 disabled:opacity-50">
              <Save className="w-6 h-6" /> Lưu nháp
            </button>
            <button disabled={pending || !audit} onClick={() => save(true)} className="inline-flex items-center gap-2.5 h-16 px-8 rounded-2xl bg-[#1565F5] text-white text-[20px] font-semibold hover:bg-[#0F55D8] disabled:opacity-50">
              <Check className="w-7 h-7" /> Lưu phiếu kiểm kê
            </button>
          </div>
          <div className="text-[17px] text-[#1E293B]">Hiển thị 1 - {view.length} trong {view.length} kết quả</div>
        </>
      )}
    </div>
  );
}
