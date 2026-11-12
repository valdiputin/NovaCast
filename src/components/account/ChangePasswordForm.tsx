"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePasswordAction } from "@/app/actions/account";

const input = "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500";

export function ChangePasswordForm() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changePasswordAction(f);
          if ("error" in res) return void toast.error(res.error);
          toast.success("Đã đổi mật khẩu");
          setF({ current: "", next: "", confirm: "" });
        });
      }}
    >
      <input type="password" className={input} placeholder="Mật khẩu hiện tại" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <input type="password" className={input} placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <input type="password" className={input} placeholder="Nhập lại mật khẩu mới" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      <button disabled={pending} className="px-5 py-2.5 rounded-xl bg-[#1565F5] text-white text-sm font-semibold disabled:opacity-50">
        {pending ? "Đang lưu..." : "Lưu mật khẩu mới"}
      </button>
    </form>
  );
}
