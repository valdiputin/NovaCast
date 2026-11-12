import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, TH, TD, THEAD } from "@/components/ui/kit";
import { RangeSelect } from "@/components/ui/RangeSelect";
import { Thumb } from "@/components/ui/Thumb";
import { formatDateTime } from "@/lib/format";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FoodReviewsPage({ searchParams }: { searchParams: Promise<{ stars?: string }> }) {
  const store = await getCurrentStore("FOOD");
  const sp = await searchParams;
  const stars = Number(sp.stars) || undefined;
  const reviews = await prisma.review.findMany({
    where: { product: { storeId: store.id }, ...(stars ? { rating: stars } : {}) },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  const all = await prisma.review.aggregate({ where: { product: { storeId: store.id } }, _avg: { rating: true }, _count: true });

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Đánh giá" />
      <PageBody>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[26px] font-bold text-[#1E293B]">
              Đánh giá khách hàng{" "}
              <span className="text-lg font-semibold text-amber-500">
                ★ {(all._avg.rating ?? 0).toFixed(1)} <span className="text-slate-400">({all._count} đánh giá)</span>
              </span>
            </h2>
            <RangeSelect param="stars" value={sp.stars} placeholder="Tất cả số sao" options={[5, 4, 3, 2, 1].map((s) => ({ value: String(s), label: `${s} sao` }))} />
          </div>
          <table className="w-full">
            <thead className={THEAD}>
              <tr>
                <th className={TH + " rounded-l-xl"}>Món</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Đánh giá</th>
                <th className={TH}>Nội dung</th>
                <th className={TH + " rounded-r-xl"}>Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className={TD}>
                    <span className="flex items-center gap-3 font-semibold text-[#1E293B]">
                      <Thumb src={r.product?.imageUrl} alt={r.product?.name ?? ""} size={44} />
                      {r.product?.name}
                    </span>
                  </td>
                  <td className={TD}>{r.authorName}</td>
                  <td className={TD}>
                    <span className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < r.rating ? "text-amber-400" : "text-slate-200"}`} fill="currentColor" />
                      ))}
                    </span>
                  </td>
                  <td className={TD}>{r.content}</td>
                  <td className={TD + " text-slate-400"}>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">Chưa có đánh giá</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </PageBody>
    </div>
  );
}
