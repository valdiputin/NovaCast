"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { errorMessage, type ActionResult } from "@/lib/guard";

const schema = z
  .object({
    current: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    next: z.string().min(8, "Mật khẩu mới tối thiểu 8 ký tự").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Xác nhận mật khẩu không khớp", path: ["confirm"] });

export async function changePasswordAction(input: z.input<typeof schema>): Promise<ActionResult> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    const me = await getCurrentUser();
    if (!me) return { error: "Phiên đăng nhập đã hết hạn" };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) return { error: "Mật khẩu hiện tại không đúng" };
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) } });
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
