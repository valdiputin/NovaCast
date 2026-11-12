"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "./common";

/** Ô chọn lọc ghi vào query string (?param=value) — dùng cho bộ lọc thời gian / loại hàng */
export function RangeSelect({
  param, value, options, icon = false, className, placeholder,
}: { param: string; value?: string; options: { value: string; label: string }[]; icon?: boolean; className?: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className={cn("relative inline-flex items-center h-12 rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-[16px] text-[#1E293B] cursor-pointer", className)}>
      {icon && <CalendarDays className="w-5 h-5 mr-2.5 text-[#1E293B]" fill="currentColor" stroke="white" />}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set(param, e.target.value);
          else q.delete(param);
          q.delete("page");
          router.push(`${pathname}?${q.toString()}`);
        }}
        className="appearance-none bg-transparent outline-none cursor-pointer pr-2"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-5 h-5 absolute right-3 pointer-events-none" />
    </label>
  );
}

/** Ô tìm kiếm ghi vào ?q= khi nhấn Enter */
export function SearchBox({ placeholder, value, className, icon = true }: { placeholder: string; value?: string; className?: string; icon?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <form
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const v = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        const q = new URLSearchParams(sp.toString());
        if (v) q.set("q", v);
        else q.delete("q");
        q.delete("page");
        router.push(`${pathname}?${q.toString()}`);
      }}
    >
      {icon && (
        <svg className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-[#1E293B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )}
      <input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className={cn("w-full h-12 rounded-xl border border-slate-200 bg-white pr-4 text-[16px] placeholder:text-slate-400 focus:outline-none focus:border-blue-500", icon ? "pl-12" : "pl-5")}
      />
    </form>
  );
}
