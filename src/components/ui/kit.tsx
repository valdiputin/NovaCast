import Link from "next/link";
import { ArrowUp, ArrowDown, CheckCircle2, AlertCircle, XCircle, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./common";
import type { Tone } from "@/lib/labels";

// ---------------------------------------------------------------------------
// Pill trạng thái (theo mockup: icon tròn hoặc chấm màu)
// ---------------------------------------------------------------------------
const PILL: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  gray: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
};
const DOT: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  gray: "bg-slate-400",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
};

export function Pill({ label, tone, mode = "icon", className }: { label: string; tone: Tone; mode?: "icon" | "dot" | "plain"; className?: string }) {
  const Icon = tone === "green" ? CheckCircle2 : tone === "amber" ? AlertCircle : tone === "red" ? XCircle : FileText;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold whitespace-nowrap", PILL[tone], className)}>
      {mode === "icon" && <Icon className="w-4 h-4 shrink-0" fill="currentColor" stroke="white" strokeWidth={2} />}
      {mode === "dot" && <span className={cn("w-2 h-2 rounded-full", DOT[tone])} />}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Khung trang & card
// ---------------------------------------------------------------------------
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("p-6 xl:p-7 space-y-5", className)}>{children}</main>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(15,23,42,0.04)]", className)}>{children}</section>;
}

export function CardTitle({ icon, children, right }: { icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-[#1E293B]">
        {icon}
        {children}
      </h2>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ô KPI
// ---------------------------------------------------------------------------
export function Change({ value, suffix, invert }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[13px] font-semibold", good ? "text-emerald-600" : "text-rose-600")}>
      {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
      {up ? "+" : ""}
      {value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%{suffix ? <span className="font-medium ml-1">{suffix}</span> : null}
    </span>
  );
}

/** % thay đổi so với kỳ trước (null nếu kỳ trước = 0) */
export function pctChange(now: number, before: number): number | null {
  if (!before) return now ? null : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}

export function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", className)}>{children}</div>;
}

/** KPI kiểu đồ ăn: icon trái, số lớn, nhãn dưới, % thay đổi dạng pill góc phải */
export function KpiPill({ icon, tileClass, value, label, change }: { icon: React.ReactNode; tileClass: string; value: string; label: string; change: number | null }) {
  return (
    <Card className="p-5 flex items-center gap-4 relative">
      <IconTile className={tileClass}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-base sm:text-lg xl:text-xl tabular-nums break-words font-bold text-[#1E293B] leading-tight">{value}</div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
      </div>
      {change !== null && (
        <span className={cn("absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold", change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          {change >= 0 ? "↑ +" : "↓ "}
          {change.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
        </span>
      )}
    </Card>
  );
}

/** KPI kiểu bán lẻ/kho: icon trái, số lớn, nhãn, dòng % thay đổi */
export function KpiStat({
  icon, tileClass, value, label, sub, className, href,
}: { icon: React.ReactNode; tileClass: string; value: React.ReactNode; label: React.ReactNode; sub?: React.ReactNode; className?: string; href?: string }) {
  const body = (
    <Card className={cn("p-5 flex items-center gap-4 h-full", href && "hover:border-blue-200 hover:shadow-md transition", className)}>
      <IconTile className={tileClass}>{icon}</IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-base sm:text-lg xl:text-xl tabular-nums break-words font-bold text-[#1E293B] leading-tight">{value}</div>
        <div className="text-sm text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="mt-1.5">{sub}</div>}
      </div>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

// ---------------------------------------------------------------------------
// Bảng & phân trang
// ---------------------------------------------------------------------------
export const TH = "px-4 py-3.5 text-left text-[14px] font-semibold text-[#1E293B] whitespace-nowrap";
// Ô bảng: không đặt cỡ chữ/màu ở đây (tránh xung đột class) — đặt ở <tbody> hoặc từng ô
export const TD = "px-4 py-3 align-middle";
export const THEAD = "bg-[#F1F5FD]";

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1)
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300"><ChevronLeft className="w-4 h-4" /></span>
        <span className="w-9 h-9 rounded-lg bg-[#1565F5] text-white flex items-center justify-center text-sm font-semibold">1</span>
        <span className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300"><ChevronRight className="w-4 h-4" /></span>
      </div>
    );
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1 || (page <= 2 && p <= 3)) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = "w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-50";
  return (
    <div className="flex items-center gap-1.5">
      {page > 1 ? <Link className={btn} href={hrefFor(page - 1)} aria-label="Trang trước"><ChevronLeft className="w-4 h-4" /></Link> : <span className={cn(btn, "text-slate-300")}><ChevronLeft className="w-4 h-4" /></span>}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-slate-400">…</span>
        ) : p === page ? (
          <span key={p} className="w-9 h-9 rounded-lg bg-[#1565F5] text-white flex items-center justify-center text-sm font-semibold">{p}</span>
        ) : (
          <Link key={p} className={btn} href={hrefFor(p)}>{p}</Link>
        )
      )}
      {page < totalPages ? <Link className={btn} href={hrefFor(page + 1)} aria-label="Trang sau"><ChevronRight className="w-4 h-4" /></Link> : <span className={cn(btn, "text-slate-300")}><ChevronRight className="w-4 h-4" /></span>}
    </div>
  );
}

/** Tạo URL giữ nguyên các tham số lọc hiện tại */
export function withParams(base: string, params: Record<string, string | number | undefined>, patch: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
