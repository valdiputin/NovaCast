import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Star } from "lucide-react";

export default async function FoodReviewsPage() {
  const store = await getCurrentStore("FOOD");

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Đánh Giá Khách Hàng"
        subtitle={`Phản hồi và chất lượng món ăn tại ${store.name}`}
      />
      <main className="p-8">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
            <Star className="w-6 h-6 fill-current" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Đánh Giá & Phản Hồi Món Ăn</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Theo dõi điểm sao (1–5 sao), trả lời phản hồi khách hàng và quản lý hiển thị đánh giá công khai.
          </p>
        </div>
      </main>
    </div>
  );
}

