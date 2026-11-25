"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStaffAction, updateStaffRoleAction, removeStaffAction } from "@/app/actions/account";

export interface StaffMemberItem {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: "OWNER" | "MANAGER" | "STAFF";
}

interface StaffManagerProps {
  storeId: string;
  currentUserId: string;
  currentRole: "OWNER" | "MANAGER" | "STAFF";
  members: StaffMemberItem[];
}

const ROLE_LABELS: Record<"OWNER" | "MANAGER" | "STAFF", string> = {
  OWNER: "Chủ cửa hàng",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
};

export function StaffManager({ storeId, currentUserId, currentRole, members }: StaffManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "STAFF">("STAFF");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const canManage = currentRole === "OWNER" || currentRole === "MANAGER";

  function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createStaffAction({
        storeId,
        fullName,
        phone,
        email,
        password,
        role,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setFullName("");
      setPhone("");
      setPassword("");
      setEmail("");
      setRole("STAFF");
      setShowForm(false);
      setMessage({ type: "success", text: "Đã thêm nhân viên và phân quyền thành công" });
      router.refresh();
    });
  }

  function handleRoleChange(memberId: string, nextRole: "OWNER" | "MANAGER" | "STAFF") {
    setMessage(null);
    startTransition(async () => {
      const res = await updateStaffRoleAction({ storeId, memberId, role: nextRole });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setMessage({ type: "success", text: "Đã cập nhật quyền nhân viên" });
      router.refresh();
    });
  }

  function handleRemove(member: StaffMemberItem) {
    if (!window.confirm(`Xóa nhân viên "${member.fullName}" khỏi cửa hàng này?`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await removeStaffAction({ storeId, memberId: member.id });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setMessage({ type: "success", text: `Đã xóa ${member.fullName} khỏi cửa hàng` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-slate-800">Nhân viên cửa hàng</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setMessage(null);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold hover:bg-blue-700 transition"
          >
            {showForm ? "Đóng form" : "+ Thêm nhân viên"}
          </button>
        )}
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded-xl text-xs font-medium ${
            message.type === "error"
              ? "bg-rose-50 text-rose-700 border border-rose-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleAddStaff} className="p-4 rounded-xl border border-blue-100 bg-slate-50/70 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Họ tên nhân viên *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn D"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tài khoản (SĐT) *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu *</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phân quyền *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "OWNER" | "MANAGER" | "STAFF")}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="STAFF">Nhân viên</option>
                <option value="MANAGER">Quản lý</option>
                {currentRole === "OWNER" && <option value="OWNER">Chủ cửa hàng</option>}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email (không bắt buộc)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="VD: nhanvien@novacast.local"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Đang lưu..." : "Lưu nhân viên"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          const canEditMember = canManage && !isSelf && (currentRole === "OWNER" || m.role !== "OWNER");

          return (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-700 truncate">
                  {m.fullName}
                  {isSelf && <span className="ml-1.5 text-xs text-blue-600">(Bạn)</span>}
                </div>
                <div className="text-xs text-slate-400">TK: {m.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                {canEditMember ? (
                  <>
                    <select
                      aria-label={`Phân quyền cho ${m.fullName}`}
                      value={m.role}
                      disabled={isPending}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as "OWNER" | "MANAGER" | "STAFF")}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                    >
                      <option value="STAFF">Nhân viên</option>
                      <option value="MANAGER">Quản lý</option>
                      {currentRole === "OWNER" && <option value="OWNER">Chủ cửa hàng</option>}
                    </select>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemove(m)}
                      className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
                    >
                      Xóa
                    </button>
                  </>
                ) : (
                  <span className="text-slate-500 text-xs font-medium">{ROLE_LABELS[m.role]}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
