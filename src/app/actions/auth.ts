"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function sendOtpAction(target: string) {
  if (!target) return { error: "Vui lòng nhập SĐT hoặc Email" };

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

  try {
    await prisma.otpCode.create({
      data: {
        target,
        codeHash,
        expiresAt,
      },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[NovaCast DEV OTP] Mã OTP cho ${target}: ${otp}`);
      return { success: true, devOtp: otp };
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Đã xảy ra lỗi";
    return { error: "Lỗi gửi mã OTP: " + msg };
  }
}

export async function loginAction(formData: FormData) {
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;
  const otp = formData.get("otp") as string;
  const isOtpRequired = process.env.OTP_REQUIRED === "true";

  if (!identifier || !password) {
    return { error: "Vui lòng nhập đầy đủ Số điện thoại/Email và Mật khẩu" };
  }

  // 1. Kiểm tra OTP nếu cấu hình yêu cầu
  if (isOtpRequired) {
    if (!otp) return { error: "Vui lòng nhập mã OTP xác thực" };
    const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
    const validOtp = await prisma.otpCode.findFirst({
      where: {
        target: identifier,
        codeHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!validOtp) {
      return { error: "Mã OTP không đúng hoặc đã hết hạn (5 phút)" };
    }

    await prisma.otpCode.update({
      where: { id: validOtp.id },
      data: { used: true },
    });
  }

  // 2. Tìm User trong Database
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }],
      isActive: true,
    },
  });

  if (!user) {
    return { error: "Tài khoản hoặc mật khẩu không chính xác" };
  }

  // 3. So khớp mật khẩu với hash bcrypt
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return { error: "Tài khoản hoặc mật khẩu không chính xác" };
  }

  // 4. Ký và lưu session an toàn
  await setSessionCookie(user.id);
  redirect("/stores");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function selectStoreAction(storeId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const member = await prisma.storeMember.findFirst({
    where: { storeId, userId: user.id },
    include: { store: true },
  });

  if (!member || !member.store) {
    return { error: "Bạn không có quyền truy cập cửa hàng này" };
  }

  const cookieStore = await cookies();
  cookieStore.set("novacast_current_store", storeId, { path: "/" });

  if (member.store.type === "FOOD") redirect("/food");
  if (member.store.type === "RETAIL") redirect("/retail");
  if (member.store.type === "WAREHOUSE") redirect("/warehouse");
}
