import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UtensilsCrossed, Shirt, Warehouse, ArrowRight } from "lucide-react";
import { selectStoreAction } from "@/app/actions/auth";

export default async function StoreSelectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const members = await prisma.storeMember.findMany({
    where: { userId: user.id },
    include: { store: true },
  });

  const stores = members.map((m) => m.store);

  const storeTypeConfig = [
    {
      type: "RETAIL" as const,
      title: "Cửa hàng bán lẻ",
      desc: "Quản lý sản phẩm biến thể, size/màu, mã vạch, bán hàng tại quầy POS, nhập/trả hàng và kiểm kê kho.",
      icon: <Shirt className="w-8 h-8 text-blue-600" />,
      color: "border-blue-100 hover:border-blue-500 hover:shadow-blue-500/10",
      tag: "Thời trang / Bán lẻ",
      tagColor: "bg-blue-50 text-blue-700",
    },
    {
      type: "FOOD" as const,
      title: "Cửa hàng đồ ăn",
      desc: "Quản lý thực đơn combo, món lẻ, định lượng nguyên liệu, voucher ưu đãi, quản lý đơn giao hàng và đánh giá.",
      icon: <UtensilsCrossed className="w-8 h-8 text-rose-600" />,
      color: "border-rose-100 hover:border-rose-500 hover:shadow-rose-500/10",
      tag: "F&B / Nhà hàng",
      tagColor: "bg-rose-50 text-rose-700",
    },
    {
      type: "WAREHOUSE" as const,
      title: "Kho doanh nghiệp",
      desc: "Quản lý nguyên vật liệu, bán thành phẩm, thành phẩm, vị trí kệ Bin, phiếu nhập/xuất kho và cân bằng tồn kho.",
      icon: <Warehouse className="w-8 h-8 text-amber-600" />,
      color: "border-amber-100 hover:border-amber-500 hover:shadow-amber-500/10",
      tag: "Kho vận / NVL",
      tagColor: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#172554] flex flex-col justify-between p-8">
      {/* Brand Header */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
            Nova<span className="text-[#F59E0B]">Cast</span>
          </h1>
          <p className="text-xs text-blue-200 mt-0.5">Chọn loại hình kinh doanh để tiếp tục</p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold text-white">{user.fullName}</p>
          <p className="text-[10px] text-blue-200">{user.phone}</p>
        </div>
      </div>

      {/* 3 Main Cards */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 my-auto">
        {storeTypeConfig.map((st) => {
          const matchedStore = stores.find((s) => s.type === st.type);

          return (
            <div
              key={st.type}
              className="bg-white rounded-3xl p-8 border border-white/20 shadow-xl transition-all duration-200 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                    {st.icon}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.tagColor}`}>
                    {st.tag}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">{st.title}</h2>
                <p className="text-xs leading-relaxed text-slate-500 mb-6">{st.desc}</p>
              </div>

              <div>
                {matchedStore ? (
                  <form
                    action={async () => {
                      "use server";
                      await selectStoreAction(matchedStore.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#1565F5] hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-md shadow-blue-500/20"
                    >
                      <span>Vào cửa hàng: {matchedStore.name}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="text-center py-2 text-xs text-slate-400 italic">
                    Chưa có cửa hàng loại này
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-6xl mx-auto w-full text-center text-xs text-blue-200/80">
        NovaCast Store Management Dashboard © 2026. Quản lý cửa hàng đa nền tảng thông minh.
      </div>
    </div>
  );
}
