"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Box, ConciergeBell, ShoppingCart, Star, PieChart, User, Home, Boxes, Ticket, Undo2, ClipboardCheck,
  Download, Upload, ChevronDown, LogOut, ArrowLeftRight, UserCircle2,
} from "lucide-react";
import { cn } from "../ui/common";
import { LogoMark, LogoText } from "../shell/Logo";
import { useShell } from "../shell/ShellContext";
import { logoutAction } from "@/app/actions/auth";

export type ModuleType = "food" | "retail" | "warehouse";

interface NavItem {
  label: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const ic = "w-6 h-6";
const NAV: Record<ModuleType, NavItem[]> = {
  // Thứ tự theo ảnh "NovaCast Vietnamese Dashboard Overview"
  food: [
    { label: "Nguyên liệu", href: "/food/categories", icon: <Box className={ic} /> },
    { label: "Sản phẩm", href: "/food/products", icon: <ConciergeBell className={ic} /> },
    { label: "Đơn hàng", href: "/food/orders", icon: <ShoppingCart className={ic} /> },
    { label: "Đánh giá", href: "/food/reviews", icon: <Star className={ic} fill="currentColor" /> },
    { label: "Tổng quan", href: "/food", icon: <PieChart className={ic} />, exact: true },
    { label: "Tài khoản", href: "/food/account", icon: <User className={ic} fill="currentColor" /> },
  ],
  retail: [
    { label: "Tổng quan", href: "/retail", icon: <Home className={ic} fill="currentColor" />, exact: true },
    { label: <>Sản phẩm &amp;<br />Biến thể</>, href: "/retail/products", icon: <Boxes className={ic} /> },
    { label: "Voucher", href: "/retail/vouchers", icon: <Ticket className={ic} /> },
    { label: <>Nhập hàng<br />(Từ NCC)</>, href: "/retail/receiving", icon: <ShoppingCart className={ic} /> },
    { label: <>Xuất &amp; Trả hàng /<br />Chuyển kho</>, href: "/retail/returns", icon: <Undo2 className={ic} /> },
    { label: "Kiểm kê tồn kho", href: "/retail/audit", icon: <ClipboardCheck className={ic} /> },
    { label: <>Bán hàng<br />tại quầy</>, href: "/retail/pos", icon: <ShoppingCart className={ic} /> },
  ],
  warehouse: [
    { label: "Tổng quan", href: "/warehouse", icon: <Home className={ic} fill="currentColor" />, exact: true },
    { label: <>Danh mục Vật tư &amp;<br />Thành phẩm</>, href: "/warehouse/items", icon: <Boxes className={ic} /> },
    { label: "Nhập kho", href: "/warehouse/receipts", icon: <Download className={ic} /> },
    { label: "Xuất kho", href: "/warehouse/issues", icon: <Upload className={ic} /> },
    { label: "Kiểm kê & Tồn kho", href: "/warehouse/audit", icon: <ClipboardCheck className={ic} /> },
    { label: "Tài khoản", href: "/warehouse/account", icon: <User className={ic} fill="currentColor" /> },
  ],
};

export function Sidebar({ moduleType }: { moduleType: ModuleType }) {
  const pathname = usePathname();
  const shell = useShell();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <aside className="w-[260px] bg-[#16213E] text-white flex flex-col shrink-0 h-screen sticky top-0 select-none">
      <Link href={`/${moduleType}`} className="h-[88px] flex items-center gap-3 px-6 border-b border-white/10">
        <LogoMark className="w-12 h-10" cart={false} />
        <LogoText className="text-[26px]" />
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {NAV[moduleType].map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl text-[17px] leading-snug transition-colors",
                active ? "bg-[#1565F5] text-white font-semibold shadow-lg shadow-blue-900/30" : "text-slate-100 hover:bg-white/10"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 p-4" ref={menuRef}>
        {open && (
          <div className="absolute bottom-[76px] left-4 right-4 bg-white text-slate-700 rounded-xl shadow-xl overflow-hidden text-sm z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-800">{shell?.userName ?? "admin"}</div>
              <div className="text-xs text-slate-400">{shell?.roleLabel} · {shell?.storeName}</div>
            </div>
            <Link href={`/${moduleType}/account`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
              <UserCircle2 className="w-4 h-4" /> Tài khoản
            </Link>
            {moduleType === "retail" && (
              <>
                <Link href="/retail/orders" className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                  <ShoppingCart className="w-4 h-4" /> Đơn hàng
                </Link>
                <Link href="/retail/partners" className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                  <User className="w-4 h-4" /> Nhà cung cấp & Khách hàng
                </Link>
              </>
            )}
            {moduleType === "warehouse" && (
              <Link href="/warehouse/partners" className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                <User className="w-4 h-4" /> Nhà cung cấp
              </Link>
            )}
            <Link href="/stores" className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
              <ArrowLeftRight className="w-4 h-4" /> Về trang chủ (đổi loại hình)
            </Link>
            <form action={logoutAction}>
              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </form>
          </div>
        )}
        <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/5">
          <span className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-[#2B6BE6] flex items-center justify-center overflow-hidden">
              <User className="w-7 h-7 text-white translate-y-1" fill="currentColor" />
            </span>
            <span className="text-[17px]">{shell?.userName ?? "admin"}</span>
          </span>
          <ChevronDown className={cn("w-5 h-5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
