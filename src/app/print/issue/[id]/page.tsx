import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { DOC_STATUS, ISSUE_TYPE } from "@/lib/labels";
import { DocSheet } from "../../DocSheet";

export const dynamic = "force-dynamic";

export default async function PrintIssue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getCurrentStore();
  const s = await prisma.stockIssue.findFirst({ where: { id, storeId: store.id }, include: { items: { include: { material: true, variant: { include: { product: true } } } } } });
  if (!s) notFound();
  return (
    <DocSheet
      storeName={store.name}
      storeAddress={store.address}
      title="Phiếu xuất kho"
      code={s.code}
      date={s.issueDate}
      status={DOC_STATUS[s.status].label}
      meta={[
        ["Loại giao dịch", `${ISSUE_TYPE[s.issueType] ?? s.issueType} ${s.workshop ?? ""}`],
        ["Ghi chú", s.note || "—"],
      ]}
      lines={s.items.map((i) => ({
        code: i.material?.sku ?? i.variant?.sku ?? "",
        name: i.material?.name ?? i.variant?.product.name ?? "",
        unit: i.material?.unit ?? "Cái",
        qty: i.quantity,
        price: Number(i.unitCost),
        total: Number(i.totalAmount),
      }))}
      total={Number(s.totalAmount)}
      by={s.createdByName}
      signers={["Người lập phiếu", "Người nhận hàng", "Thủ kho", "Kế toán"]}
    />
  );
}
