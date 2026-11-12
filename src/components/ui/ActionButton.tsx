"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "./common";

type Result = { success: true } | { error: string };

/**
 * Nút gọi một Server Action đã bind sẵn tham số (VD: deleteProductAction.bind(null, id)).
 * Có hộp xác nhận tùy chọn; toast hiển thị theo kết quả thật của action.
 */
export function ActionButton({
  action, confirmText, successText, altSuccess, children, className, title,
}: {
  action: () => Promise<Result & Record<string, unknown>>;
  confirmText?: string;
  successText: string;
  /** Thông báo thay thế khi kết quả có cờ `key` = true (VD: deactivated) — chỉ dùng dữ liệu tuần tự hóa được */
  altSuccess?: { key: string; text: string };
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      className={cn("disabled:opacity-40", className)}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        start(async () => {
          const res = await action();
          if ("error" in res) return void toast.error(res.error as string);
          toast.success(altSuccess && (res as Record<string, unknown>)[altSuccess.key] ? altSuccess.text : successText);
          router.refresh();
        });
      }}
    >
      {children}
    </button>
  );
}
