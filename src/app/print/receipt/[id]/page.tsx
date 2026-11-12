import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { DOC_STATUS, RECEIPT_TYPE } from "@/lib/labels";
import { DocSheet } from "../../DocSheet";

export const dynamic = "force-dynamic";

export default async function PrintReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getCurrentStore();
  const r = await prisma.stockReceipt.findFirst({
    where: { id, storeId: store.id },
    include: { supplier: true, items: { include: { variant: { include: { product: true } }, material: true } } },
  });
  if (!r) notFound();
  return (
    <DocSheet
      storeName={store.name}
      storeAddress={store.address}
      title="Phiếu nhập kho"
      code={r.code}
      date={r.receiptDate}
      status={DOC_STATUS[r.status].label}
      meta={[
        ["Nhà cung cấp", r.supplier?.name ?? "—"],
        ["Loại phiếu", RECEIPT_TYPE[r.receiptType] ?? r.receiptType],
        ["Ghi chú", r.note || "—"],
      ]}
      lines={r.items.map((i) => ({
        code: i.variant?.sku ?? i.material?.sku ?? "",
        name: i.variant ? `${i.variant.product.name} (${i.variant.name})` : i.material?.name ?? "",
        unit: i.material?.unit ?? "Cái",
        qty: i.quantity,
        price: Number(i.unitCost),
        discount: i.discountRate,
        total: Number(i.totalAmount),
      }))}
      total={Number(r.totalAmount)}
      by={r.createdByName}
      signers={["Người lập phiếu", "Người giao hàng", "Thủ kho", "Kế toán"]}
    />
  );
}
