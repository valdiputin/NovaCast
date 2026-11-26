"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, User } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  variant?: "bell" | "admin";
}

const NOTIF_BADGE: Record<string, { label: string; cls: string }> = {
  OVERSTOCK: { label: "Tồn quá mức", cls: "bg-amber-100 text-amber-800" },
  LOW_STOCK: { label: "Sắp hết hàng", cls: "bg-rose-100 text-rose-700" },
  NEW_ORDER: { label: "Đơn mới", cls: "bg-blue-100 text-blue-700" },
  PENDING_DOCUMENT: { label: "Chờ duyệt", cls: "bg-purple-100 text-purple-700" },
};

export function Header({ title, subtitle, actions, variant }: HeaderProps) {
  const shell = useShell();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
  const unread = shell?.unread ?? 0;

  function handleItemClick(id: string, isRead: boolean, linkUrl?: string | null) {
    setOpen(false);
    startTransition(async () => {
      if (!isRead) {
        await markNotificationReadAction(id);
      }
      if (linkUrl) {
        router.push(linkUrl);
      } else {
        router.refresh();
      }
    });
  }

  function handleReadAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <header className="h-[88px] bg-white/80 backdrop-blur border-b border-slate-100 px-7 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-[28px] font-bold text-[#1E293B] tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-5" ref={ref}>
        {actions}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="relative p-1.5 text-[#1E293B] hover:bg-slate-100 rounded-full transition"
          title="Thông báo"
        >
          <Bell className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {v === "bell" ? (
          <Link href={accountHref} className="flex items-center gap-1.5">
            <span className="w-12 h-12 rounded-full bg-[#1D4ED8] text-white text-xl font-semibold flex items-center justify-center">
              {name.charAt(0).toUpperCase()}
            </span>
            <ChevronDown className="w-5 h-5 text-slate-500" />
          </Link>
        ) : (
          <Link href={accountHref} className="flex items-center gap-3" title="Tài khoản">
            <span className="text-[17px] text-[#1E293B]">{name}</span>
            <span className="w-12 h-12 rounded-full bg-[#E5323B] flex items-center justify-center overflow-hidden">
              <User className="w-8 h-8 text-white translate-y-1.5" fill="currentColor" />
            </span>
          </Link>
        )}

        {open && (
          <div className="absolute right-7 top-[76px] w-96 max-h-[420px] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Thông báo ({unread} chưa đọc)</span>
              {unread > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleReadAll}
                  className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                >
                  Đọc tất cả
                </button>
              )}
            </div>
            {(shell?.notifications ?? []).length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">Không có thông báo</div>
            ) : (
              shell!.notifications.map((n) => {
                const badge = NOTIF_BADGE[n.type];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n.id, n.isRead, n.linkUrl)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition ${
                      !n.isRead ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{n.title}</span>
                      {badge && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.at)}</div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </header>
  );
}
