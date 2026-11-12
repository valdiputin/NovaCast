import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { PageBody, withParams } from "@/components/ui/kit";
import { DocToolbar } from "@/components/docs/DocToolbar";
import { IssuePanel, type IssueDraft } from "@/components/docs/IssuePanel";
import { DocList } from "../DocList";
import { warehouseCatalog } from "../docData";
import { ISSUE_FILTER, ISSUE_TYPE } from "@/lib/labels";
import { RANGE_OPTIONS, rangeFilter } from "@/lib/stats";
import { toVnInput } from "@/lib/date";
import { Upload } from "lucide-react";
import type { IssueType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const SIZE = 5;

type SP = { q?: string; type?: string; range?: string; page?: string; new?: string; edit?: string };

export default async function WarehouseIssuesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("WAREHOUSE");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "30d";
  const where: Prisma.StockIssueWhereInput = {
    storeId: store.id,
    ...(sp.type && sp.type in ISSUE_FILTER ? { issueType: sp.type as IssueType } : {}),
    ...(rangeFilter(range) ? { issueDate: rangeFilter(range) } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { workshop: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, { catalog, locations }, editing] = await Promise.all([
    prisma.stockIssue.findMany({ where, include: { items: { include: { material: true } } }, orderBy: { issueDate: "desc" }, skip: (page - 1) * SIZE, take: SIZE }),
    prisma.stockIssue.count({ where }),
    warehouseCatalog(store.id),
    sp.edit ? prisma.stockIssue.findFirst({ where: { id: sp.edit, storeId: store.id }, include: { items: true } }) : null,
  ]);
  const params = { q: sp.q, type: sp.type, range: sp.range, page: sp.page };
  const base = "/warehouse/issues";
  const draft: IssueDraft | null = editing
    ? {
        id: editing.id, code: editing.code, status: editing.status, issueType: (editing.issueType === "PRODUCTION" || editing.issueType === "CUSTOMER" || editing.issueType === "DISPOSE" ? editing.issueType : "PRODUCTION"),
        workshop: editing.workshop ?? "", date: toVnInput(editing.issueDate), note: editing.note ?? "",
        lines: editing.items.map((i) => ({ key: i.id, itemId: i.materialId ?? "", qty: i.quantity, price: Number(i.unitCost), discount: 0, locationId: i.locationId ?? undefined })),
      }
    : sp.new
    ? { issueType: "PRODUCTION", workshop: "Xưởng May 1", date: toVnInput(), note: "", lines: [] }
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Xuất kho" />
      <PageBody className="space-y-4">
        <DocToolbar
          labeled
          showSearch={false}
          q={sp.q}
          selects={[
            { param: "type", value: sp.type, label: "Loại phiếu", placeholder: "Tất cả loại phiếu", icon: <Upload className="w-5 h-5 mr-3" />, options: Object.entries(ISSUE_FILTER).map(([v, l]) => ({ value: v, label: l })) },
            { param: "range", value: range, label: "Khoảng thời gian", options: RANGE_OPTIONS },
          ]}
          createHref={withParams(base, params, { new: 1 })}
          createLabel="Tạo phiếu xuất"
        />
        <DocList
          base={base}
          params={params}
          page={page}
          size={SIZE}
          total={total}
          printKind="issue"
          selectedId={sp.edit}
          rows={rows.map((r) => {
            const units = [...new Set(r.items.map((i) => i.material?.unit?.toLowerCase() ?? ""))];
            return {
              id: r.id, code: r.code, date: r.issueDate, typeLine: ISSUE_TYPE[r.issueType] ?? r.issueType, partyLine: r.workshop ?? "",
              qtyLine: `${r.items.reduce((s, i) => s + i.quantity, 0).toLocaleString("vi-VN")} ${units.length === 1 ? units[0] : "đv"}`,
              amount: r.totalAmount, by: r.createdByName ?? "—", status: r.status,
            };
          })}
        />
        {draft && <IssuePanel key={draft.id ?? "new"} catalog={catalog} locations={locations} initial={draft} closeHref={withParams(base, params, {})} />}
      </PageBody>
    </div>
  );
}
