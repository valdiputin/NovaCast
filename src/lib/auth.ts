import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import crypto from "crypto";

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: string;
}

const SECRET = process.env.AUTH_SECRET || "novacast-secret-super-key-32-chars-long-123456";

/**
 * Ký session token bằng HMAC-SHA256
 */
export function signSession(userId: string): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(userId);
  const signature = hmac.digest("hex");
  return `${userId}.${signature}`;
}

/**
 * Xác thực session token đã ký
 */
export function verifySession(token: string): string | null {
  if (!token || !token.includes(".")) return null;
  const [userId, signature] = token.split(".");
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(userId);
  const expected = hmac.digest("hex");
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return userId;
  }
  return null;
}

/**
 * Lấy user hiện tại từ cookie đã ký (KHÔNG có fallback admin bừa bãi)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("novacast_session")?.value;
  if (!token) return null;

  const userId = verifySession(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
    select: { id: true, fullName: true, phone: true, email: true },
  });

  if (!user) return null;

  return {
    ...user,
    role: "STAFF", // role theo ngữ cảnh store
  };
}

/**
 * Lấy store hiện tại và kiểm tra quyền thành viên StoreMember
 */
export async function getCurrentStore(requiredType?: "FOOD" | "RETAIL" | "WAREHOUSE") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const storeId = cookieStore.get("novacast_current_store")?.value;

  if (storeId) {
    const member = await prisma.storeMember.findFirst({
      where: { storeId, userId: user.id },
      include: { store: true },
    });

    if (member && member.store) {
      if (requiredType && member.store.type !== requiredType) {
        redirect("/stores");
      }
      return member.store;
    }
  }

  // Nếu chưa chọn hoặc store không hợp lệ, lấy store đầu tiên user thuộc về
  const member = await prisma.storeMember.findFirst({
    where: {
      userId: user.id,
      store: requiredType ? { type: requiredType } : undefined,
    },
    include: { store: true },
  });

  if (!member || !member.store) {
    redirect("/stores");
  }

  return member.store;
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  const token = signSession(userId);
  cookieStore.set("novacast_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 ngày
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("novacast_session");
  cookieStore.delete("novacast_current_store");
  cookieStore.delete("novacast_current_store_type");
}
