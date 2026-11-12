import { getCurrentStore } from "@/lib/auth";
import { VoucherListPage } from "@/components/vouchers/VoucherListPage";

export const dynamic = "force-dynamic";

export default async function FoodVouchersPage() {
  const store = await getCurrentStore("FOOD");
  return <VoucherListPage store={store} />;
}
