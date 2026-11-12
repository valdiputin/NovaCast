"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, Plus, RotateCw, Search } from "lucide-react";
import { cn } from "../ui/common";

interface SelectDef {
  param: string;
  value?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
}

/** Thanh công cụ trang chứng từ: tìm kiếm + bộ lọc + [Tìm kiếm] [Làm mới] + [Tạo phiếu] */
export function DocToolbar({
  placeholder, q, selects, createHref, createLabel, labeled, showSearch = true,
}: { placeholder?: string; q?: string; selects: SelectDef[]; createHref: string; createLabel: string; labeled?: boolean; showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const qs = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (String(v)) qs.set(k, String(v));
    router.push(`${pathname}?${qs.toString()}`);
  };
  const box = "h-[52px] rounded-xl border border-slate-200 bg-white text-[17px] text-[#1E293B]";
  return (
    <form
      key={sp.toString()}
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      {showSearch && (
        <label className="relative flex-1 min-w-[300px] max-w-[560px]">
          <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-[#1E293B]" />
          <input name="q" defaultValue={q} placeholder={placeholder} className={cn(box, "w-full pl-14 pr-4 placeholder:text-slate-400 focus:outline-none focus:border-blue-500")} />
        </label>
      )}
      {selects.map((s) => (
        <label key={s.param} className="block">
          {labeled && s.label && <span className="block text-[17px] font-semibold text-[#1E293B] mb-1.5">{s.label}</span>}
          <span className={cn(box, "relative inline-flex items-center min-w-[230px] pl-4 pr-10")}>
            {s.icon ?? (s.param === "range" ? <CalendarDays className="w-5 h-5 mr-3" fill="currentColor" stroke="white" /> : null)}
            <select
              name={s.param}
              defaultValue={s.value ?? ""}
              onChange={(e) => submit(e.currentTarget.form!)}
              className="appearance-none bg-transparent outline-none w-full cursor-pointer"
            >
              {s.placeholder !== undefined && <option value="">{s.placeholder}</option>}
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="w-5 h-5 absolute right-3 pointer-events-none" />
          </span>
        </label>
      ))}
      <button type="submit" className="inline-flex items-center gap-2.5 h-[52px] px-6 rounded-xl bg-[#1565F5] text-white text-[17px] font-semibold hover:bg-[#0F55D8]">
        <Search className="w-5 h-5" /> Tìm kiếm
      </button>
      <Link href={pathname} className="inline-flex items-center gap-2.5 h-[52px] px-6 rounded-xl border border-slate-200 bg-white text-[17px] font-semibold text-[#1E293B] hover:bg-slate-50">
        <RotateCw className="w-5 h-5" /> Làm mới
      </Link>
      <Link href={createHref} scroll={false} className="ml-auto inline-flex items-center gap-2.5 h-[52px] px-6 rounded-xl bg-[#1565F5] text-white text-[17px] font-semibold hover:bg-[#0F55D8]">
        <Plus className="w-6 h-6" /> {createLabel}
      </Link>
    </form>
  );
}
