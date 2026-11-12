"use client";

import { useState } from "react";
import { loginAction, sendOtpAction } from "@/app/actions/auth";
import { ArrowRight, Lock, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleSendOtp = async () => {
    if (!identifier) {
      toast.error("Vui lòng nhập SĐT hoặc Email trước khi nhận mã OTP");
      return;
    }
    const res = await sendOtpAction(identifier);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setCountdown(60);
      if (res.devOtp) {
        toast.success(`Mã OTP (môi trường Dev): ${res.devOtp}`);
        setOtp(res.devOtp);
      } else {
        toast.success("Mã OTP đã được gửi đến số điện thoại / email của bạn");
      }
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#172554] flex flex-col items-center justify-center p-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
          Nova<span className="text-[#F59E0B]">Cast</span>
        </h1>
        <p className="text-xs text-blue-200 mt-1 font-medium">
          Quản lý cửa hàng của bạn một cách thông minh
        </p>
      </div>

      {/* Login Card */}
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-white/20">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-slate-800">Đăng Nhập</h2>
          <p className="text-xs text-slate-400 mt-1">Truy cập bảng điều khiển quản lý cửa hàng</p>
        </div>

        <form
          action={async (formData) => {
            setLoading(true);
            const res = await loginAction(formData);
            if (res?.error) {
              toast.error(res.error);
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          {/* SĐT / Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              SĐT / Email
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                name="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Nhập số điện thoại hoặc email"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* OTP */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Mã OTP
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  name="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Nhập 6 số OTP"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={countdown > 0}
                className="px-4 py-2.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-semibold shrink-0 transition-colors disabled:opacity-50"
              >
                {countdown > 0 ? `${countdown}s` : "Gửi mã"}
              </button>
            </div>
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Nút Đăng nhập */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl bg-[#1565F5] hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-70"
          >
            <span>{loading ? "Đang xử lý..." : "Đăng Nhập"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center text-[11px] text-slate-500">
            Tài khoản dev: <span className="font-semibold text-slate-700">0900000000</span> | Mật khẩu: <span className="font-semibold text-slate-700">admin123</span>
          </div>
        )}
      </div>
    </div>
  );
}
