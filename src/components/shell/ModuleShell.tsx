import { Sidebar, type ModuleType } from "@/components/layout/Sidebar";
import { ShellProvider } from "./ShellContext";
import { getCurrentStore, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/guard";

const TYPE: Record<ModuleType, "FOOD" | "RETAIL" | "WAREHOUSE"> = { food: "FOOD", retail: "RETAIL", warehouse: "WAREHOUSE" };

/** Layout chung của 3 mô-đun: kiểm tra đúng loại cửa hàng + nạp dữ liệu cho sidebar/header */
export async function ModuleShell({ module, children }: { module: ModuleType; children: React.ReactNode }) {
  const store = await getCurrentStore(TYPE[module]);
  const [user, unread, notes] = await Promise.all([
    getCurrentUser(),
    prisma.notification.count({ where: { storeId: store.id, isRead: false } }),
    prisma.notification.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <ShellProvider
      value={{
        module,
        storeName: store.name,
        userName: user?.fullName ?? "admin",
        roleLabel: roleLabel(store.currentRole),
        unread,
        notifications: notes.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: n.isRead,
          linkUrl: n.linkUrl,
          at: n.createdAt.toISOString(),
        })),
      }}
    >
      <div className="flex min-h-screen bg-[#F5F7FB]">
        <Sidebar moduleType={module} />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
    </ShellProvider>
  );
}
