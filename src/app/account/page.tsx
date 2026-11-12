import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Shield } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F5F7FB]">
      <Header
        title="Quản Lý Tài Khoản"
        subtitle="Thông tin cá nhân, phân quyền và bảo mật"
      />
      <main className="p-8 max-w-2xl">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              {user?.fullName?.charAt(0) || "U"}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{user?.fullName}</h3>
              <p className="text-xs text-slate-400">SĐT: {user?.phone} · Email: {user?.email ?? "Chưa liên kết"}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="text-slate-500">Phân quyền hệ thống:</span>
              <span className="font-bold text-blue-600 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 inline" />
                <span>Chủ sở hữu (OWNER)</span>
              </span>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full py-3 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 transition-colors"
            >
              Đăng Xuất Khỏi Hệ Thống
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
