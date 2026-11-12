import { Header } from "@/components/layout/Header";
import { Card, PageBody } from "@/components/ui/kit";
import { getCurrentStore, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/guard";
import { logoutAction } from "@/app/actions/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";
import Link from "next/link";

export async function AccountView({ type }: { type: "FOOD" | "RETAIL" | "WAREHOUSE" }) {
  const store = await getCurrentStore(type);
  const user = await getCurrentUser();
  const members = await prisma.storeMember.findMany({ where: { storeId: store.id }, include: { user: true }, orderBy: { role: "asc" } });
  return (
    <div className="flex-1 flex flex-col">
      <Header title="Tài khoản" subtitle={store.name} />
      <PageBody className="grid grid-cols-1 xl:grid-cols-2 gap-5 space-y-0">
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1D4ED8] text-white text-2xl font-bold flex items-center justify-center">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">{user?.fullName}</div>
              <div className="text-sm text-slate-500">SĐT: {user?.phone} · Email: {user?.email ?? "—"}</div>
              <div className="mt-1 inline-block px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                {roleLabel(store.currentRole)} — {store.name}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/stores" className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50">
              Đổi loại hình cửa hàng
            </Link>
            <form action={logoutAction}>
              <button className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50">Đăng xuất</button>
            </form>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 mb-2">Nhân viên cửa hàng</h3>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{m.user.fullName}</span>
                  <span className="text-slate-500">{roleLabel(m.role)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">Đổi mật khẩu</h3>
          <ChangePasswordForm />
        </Card>
      </PageBody>
    </div>
  );
}
