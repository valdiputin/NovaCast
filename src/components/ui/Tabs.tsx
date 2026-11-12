import Link from "next/link";
import { cn } from "./common";

/** Tab dạng nút, chuyển bằng query string (?tab=...) */
export function LinkTabs({ tabs, active, size = "md" }: { tabs: { key: string; label: React.ReactNode; href: string; icon?: React.ReactNode; activeClass?: string }[]; active: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex flex-wrap gap-3", size === "md" && "bg-slate-100 p-1 rounded-xl w-fit gap-1")}>
      {tabs.map((t) =>
        size === "lg" ? (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "flex items-center gap-3 px-7 h-14 rounded-xl text-[19px] font-semibold transition",
              t.key === active ? t.activeClass ?? "bg-[#1565F5] text-white shadow-lg shadow-blue-500/25" : "bg-[#E8EDF6] text-[#1E293B] hover:bg-[#DDE4F1]"
            )}
          >
            {t.icon}
            {t.label}
          </Link>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold", t.key === active ? "bg-white text-[#1565F5] shadow" : "text-slate-600 hover:text-slate-900")}
          >
            {t.label}
          </Link>
        )
      )}
    </div>
  );
}
