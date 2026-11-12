"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  ShoppingBag,
  Ticket,
  Star,
  Users,
  Store as StoreIcon,
  Shirt,
  ScanBarcode,
  Truck,
  RotateCcw,
  ClipboardCheck,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  LogOut,
  Home,
} from "lucide-react";
import { cn } from "../ui/common";

export type ModuleType = "food" | "retail" | "warehouse";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function Sidebar({ moduleType }: { moduleType: ModuleType }) {
  const pathname = usePathname();

  const foodNav: NavItem[] = [
    { label: "Tổng quan", href: "/food", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Danh mục", href: "/food/categories", icon: <Layers className="w-5 h-5" /> },
    { label: "Sản phẩm", href: "/food/products", icon: <UtensilsCrossed className="w-5 h-5" /> },
    { label: "Nguyên liệu", href: "/food/materials", icon: <Boxes className="w-5 h-5" /> },
    { label: "Đơn hàng", href: "/food/orders", icon: <ShoppingBag className="w-5 h-5" /> },
    { label: "Voucher", href: "/food/vouchers", icon: <Ticket className="w-5 h-5" /> },
    { label: "Đánh giá", href: "/food/reviews", icon: <Star className="w-5 h-5" /> },
    { label: "Tài khoản", href: "/account", icon: <Users className="w-5 h-5" /> },
  ];

  const retailNav: NavItem[] = [
    { label: "Tổng quan", href: "/retail", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Sản phẩm & Biến thể", href: "/retail/products", icon: <Shirt className="w-5 h-5" /> },
    { label: "Voucher", href: "/retail/vouchers", icon: <Ticket className="w-5 h-5" /> },
    { label: "Bán hàng tại quầy", href: "/retail/pos", icon: <ScanBarcode className="w-5 h-5" /> },
    { label: "Đơn hàng", href: "/retail/orders", icon: <ShoppingBag className="w-5 h-5" /> },
    { label: "Nhập hàng (Từ NCC)", href: "/retail/receiving", icon: <Truck className="w-5 h-5" /> },
    { label: "Xuất & Trả hàng", href: "/retail/returns", icon: <RotateCcw className="w-5 h-5" /> },
    { label: "Kiểm kê tồn kho", href: "/retail/audit", icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: "Đối tác", href: "/retail/partners", icon: <Users className="w-5 h-5" /> },
    { label: "Tài khoản", href: "/account", icon: <Users className="w-5 h-5" /> },
  ];

  const warehouseNav: NavItem[] = [
    { label: "Tổng quan", href: "/warehouse", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Vật tư & Thành phẩm", href: "/warehouse/items", icon: <Boxes className="w-5 h-5" /> },
    { label: "Nhập kho", href: "/warehouse/receipts", icon: <ArrowDownToLine className="w-5 h-5" /> },
    { label: "Xuất kho", href: "/warehouse/issues", icon: <ArrowUpFromLine className="w-5 h-5" /> },
    { label: "Kiểm kê & Tồn kho", href: "/warehouse/audit", icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: "Đối tác", href: "/warehouse/partners", icon: <Users className="w-5 h-5" /> },
    { label: "Tài khoản", href: "/account", icon: <Users className="w-5 h-5" /> },
  ];

  const navItems =
    moduleType === "food"
      ? foodNav
      : moduleType === "retail"
      ? retailNav
      : warehouseNav;

  return (
    <aside className="w-[270px] bg-[#16213E] text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none shadow-xl">
      {/* Top Header / Logo */}
      <div>
        <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
          <Link href="/stores" className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <StoreIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight leading-none text-white">
                Nova<span className="text-[#F59E0B]">Cast</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                {moduleType === "food"
                  ? "Cửa hàng đồ ăn"
                  : moduleType === "retail"
                  ? "Cửa hàng bán lẻ"
                  : "Kho doanh nghiệp"}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] scrollbar-none">
          {navItems.map((item) => {
            const isActive =
              item.href === `/${moduleType}`
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-[#1565F5] text-white shadow-lg shadow-blue-600/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                )}
              >
                <span className={cn(isActive ? "text-white" : "text-slate-400")}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-4 border-t border-slate-700/50 bg-[#121b33]">
        <Link
          href="/stores"
          className="flex items-center space-x-3 px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors mb-2"
        >
          <Home className="w-4 h-4 text-slate-400" />
          <span>Về trang chủ (Đổi loại hình)</span>
        </Link>

        {/* User bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30">
              AD
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-100 leading-tight">Admin</span>
              <span className="text-[10px] text-slate-400">admin@novacast.local</span>
            </div>
          </div>
          <Link href="/login" title="Đăng xuất" className="text-slate-400 hover:text-rose-400 transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
