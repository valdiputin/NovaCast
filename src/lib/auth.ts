import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import crypto from "crypto";

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: "OWNER" | "MANAGER" | "STAFF";
}

interface SessionPayload {
  userId: string;
  exp: number; // timestamp ms
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("LỖI BẢO MẬT: AUTH_SECRET chưa được cấu hình hoặc quá ngắn trong biến môi trường!");
  }
  return secret;
}

/**
 * Ký session token bằng HMAC-SHA256 kèm thời hạn hết hạn
 */
export function signSession(userId: string, expiresInMs = 7 * 24 * 60 * 60 * 1000): string {
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + expiresInMs,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(payloadStr);
  const signature = hmac.digest("base64url");
  return `${payloadStr}.${signature}`;
}

/**
 * Xác thực session token đã ký chống tấn công timing và chống crash
 */
export function verifySession(token: string): string | null {
  try {
    if (!token || !token.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;

    const hmac = crypto.createHmac("sha256", getSecret());
    hmac.update(payloadStr);
    const expected = hmac.digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8")
    );

    if (Date.now() > payload.exp) {
      return null; // Hết hạn phiên
    }

    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * Lấy user hiện tại từ cookie đã ký
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

  // Lấy role cao nhất của user trong các store
  const member = await prisma.storeMember.findFirst({
    where: { userId: user.id },
    select: { role: true },
    orderBy: { role: "asc" }, // OWNER < MANAGER < STAFF
  });

  return {
    ...user,
    role: (member?.role as SessionUser["role"]) ?? "STAFF",
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
      return { ...member.store, currentRole: member.role };
    }
  }

  // Lấy store đầu tiên user thuộc về
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

  return { ...member.store, currentRole: member.role };
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  const token = signSession(userId);
  cookieStore.set("novacast_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("novacast_session");
  cookieStore.delete("novacast_current_store");
  cookieStore.delete("novacast_current_store_type");
}
