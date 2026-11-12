import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { barcodeSvg } from "@/lib/barcode";
import { discounted } from "@/lib/labels";
import { PrintToolbar } from "../PrintToolbar";

export const dynamic = "force-dynamic";

/** In tem mã vạch 50×30mm cho các biến thể của sản phẩm đã chọn (?ids=a,b,c) */
export default async function PrintLabels({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const sp = await searchParams;
  const store = await getCurrentStore("RETAIL");
  const ids = (sp.ids ?? "").split(",").filter(Boolean).slice(0, 200);
  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: ids }, deletedAt: null, product: { storeId: store.id } },
    include: { product: true },
    orderBy: { sku: "asc" },
  });
  return (
    <div className="max-w-[900px] mx-auto bg-white p-8 print:p-0">
      <style>{`@page { size: 50mm 30mm; margin: 0 } @media print { .label { break-after: page } }`}</style>
      <PrintToolbar />
      <div className="flex flex-wrap gap-4 print:block">
        {variants.map((v) => {
          const price = Number(v.price);
          const pct = v.discountPercent || v.product.discountPercent;
          return (
            <div key={v.id} className="label w-[50mm] h-[30mm] border border-slate-300 print:border-0 rounded p-[2mm] flex flex-col justify-between text-[8pt] leading-tight overflow-hidden">
              <div className="font-bold truncate">{v.product.name}</div>
              <div className="truncate">{v.name}</div>
              <div className="h-[11mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: barcodeSvg(v.barcode ?? v.sku, { height: 9, includeText: false }) }} />
              <div className="flex justify-between">
                <span>{v.sku}</span>
                <b>{(pct ? discounted(price, pct) : price).toLocaleString("vi-VN")}đ</b>
              </div>
            </div>
          );
        })}
        {variants.length === 0 && <p className="text-slate-500">Không có sản phẩm nào được chọn.</p>}
      </div>
    </div>
  );
}
