"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, User } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { formatDateTime } from "@/lib/format";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** "bell": chuông + avatar chữ A (ảnh đồ ăn / Sản phẩm bán lẻ); "admin": chữ admin + avatar đỏ */
  variant?: "bell" | "admin";
}

export function Header({ title, subtitle, actions, variant }: HeaderProps) {
  const shell = useShell();
  const v = variant ?? (shell?.module === "food" ? "bell" : "admin");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const accountHref = `/${shell?.module ?? "food"}/account`;
  const name = shell?.userName ?? "admin";

  return (
    <header className="h-[88px] bg-white/80 backdrop-blur border-b border-slate-100 px-7 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-[28px] font-bold text-[#1E293B] tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-5" ref={ref}>
        {actions}
        {v === "bell" ? (
          <>
            <button type="button" onClick={() => setOpen((o) => !o)} className="relative p-1.5 text-[#1E293B]" title="Thông báo">
              <Bell className="w-7 h-7" />
              {(shell?.unread ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                  {shell!.unread}
                </span>
              )}
            </button>
            <Link href={accountHref} className="flex items-center gap-1.5">
              <span className="w-12 h-12 rounded-full bg-[#1D4ED8] text-white text-xl font-semibold flex items-center justify-center">
                {name.charAt(0).toUpperCase()}
              </span>
              <ChevronDown className="w-5 h-5 text-slate-500" />
            </Link>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setOpen((o) => !o)} className="text-[17px] text-[#1E293B]">
              {name}
            </button>
            <Link href={accountHref} className="w-12 h-12 rounded-full bg-[#E5323B] flex items-center justify-center overflow-hidden" title="Tài khoản">
              <User className="w-8 h-8 text-white translate-y-1.5" fill="currentColor" />
            </Link>
          </>
        )}
        {open && (
          <div className="absolute right-7 top-[76px] w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">Thông báo</div>
            {(shell?.notifications ?? []).length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">Không có thông báo</div>
            ) : (
              shell!.notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                  <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                  <div className="text-sm text-slate-500">{n.message}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(n.at)}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  );
}
