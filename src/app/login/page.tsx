"use client";

import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { loginAction, sendOtpAction } from "@/app/actions/auth";
import { BlueBackdrop } from "@/components/shell/BlueBackdrop";

const input =
  "w-full h-14 px-5 rounded-2xl border border-slate-200 bg-white text-[17px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1565F5] focus:ring-4 focus:ring-blue-100 transition";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [countdown, setCountdown] = useState(0);

  const sendOtp = async () => {
    if (!identifier) return void toast.error("Vui lòng nhập SĐT hoặc Email trước khi nhận mã OTP");
    const res = await sendOtpAction(identifier);
    if (res?.error) return void toast.error(res.error);
    toast.success(res?.devOtp ? `Mã OTP (môi trường dev): ${res.devOtp}` : "Đã gửi mã OTP");
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? (clearInterval(t), 0) : c - 1)), 1000);
  };

  return (
    <BlueBackdrop>
      <form
        action={async (fd) => {
          setLoading(true);
          const res = await loginAction(fd);
          if (res?.error) {
            toast.error(res.error);
            setLoading(false);
          }
        }}
        className="w-full max-w-[600px] bg-white rounded-[28px] shadow-2xl shadow-blue-950/30 px-11 py-10"
      >
        <h1 className="flex items-center gap-4 text-[30px] font-bold text-[#1E293B]">
          <Lock className="w-9 h-9 text-[#1565F5]" fill="currentColor" stroke="white" />
          Đăng nhập
        </h1>
        <p className="text-slate-500 text-lg mt-3 mb-5">Vui lòng đăng nhập để truy cập bảng điều khiển</p>

        <label className="block font-bold text-[#1E293B] mb-2">SĐT/Email</label>
        <input name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={input} placeholder="Nhập số điện thoại hoặc email" autoComplete="username" required />

        <label className="block font-bold text-[#1E293B] mt-5 mb-2">OTP</label>
        <div className="relative">
          <input name="otp" inputMode="numeric" maxLength={6} className={input + " pr-32"} placeholder="Nhập mã OTP (6 số)" autoComplete="one-time-code" />
          <button type="button" onClick={sendOtp} disabled={countdown > 0} className="absolute right-2 top-2 h-10 px-4 rounded-xl text-sm font-semibold text-[#1565F5] bg-blue-50 hover:bg-blue-100 disabled:opacity-50">
            {countdown > 0 ? `Gửi lại (${countdown}s)` : "Gửi mã"}
          </button>
        </div>

        <label className="block font-bold text-[#1E293B] mt-5 mb-2">Mật khẩu</label>
        <input name="password" type="password" className={input} placeholder="Nhập mật khẩu" autoComplete="current-password" required />

        <button type="submit" disabled={loading} className="w-full h-16 mt-4 rounded-full bg-[#0B5CEB] hover:bg-[#0A52D4] text-white text-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 disabled:opacity-70">
          {loading ? "Đang xử lý..." : "Đăng Nhập"}
          <ArrowRight className="w-6 h-6" />
        </button>
        {process.env.NODE_ENV === "development" && (
          <p className="text-center text-xs text-slate-400 mt-4">Tài khoản demo: 0900000000 / admin123</p>
        )}
      </form>
    </BlueBackdrop>
  );
}
