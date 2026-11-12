import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/auth";

// Đường dẫn cũ /account → chuyển tới trang tài khoản của loại cửa hàng đang chọn
export default async function AccountRedirect() {
  const store = await getCurrentStore();
  redirect(`/${store.type.toLowerCase()}/account`);
}
