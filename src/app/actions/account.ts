"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
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

const createStaffSchema = z.object({
  storeId: z.string().min(1, "Thiếu thông tin cửa hàng"),
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên nhân viên").max(100),
  phone: z.string().trim().min(8, "Số điện thoại / tài khoản tối thiểu 8 ký tự").max(20),
  email: z.string().trim().email("Email không hợp lệ").optional().or(z.literal("")),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(100),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
});

function revalidateAccountPages() {
  revalidatePath("/retail/account");
  revalidatePath("/food/account");
  revalidatePath("/warehouse/account");
}

export async function createStaffAction(input: z.input<typeof createStaffSchema>): Promise<ActionResult> {
  try {
    const parsed = createStaffSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

    const me = await getCurrentUser();
    if (!me) return { error: "Phiên đăng nhập đã hết hạn" };

    const { storeId, fullName, phone, email, password, role } = parsed.data;
    const caller = await prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: me.id } },
    });

    if (!caller || (caller.role !== "OWNER" && caller.role !== "MANAGER")) {
      return { error: "Bạn không có quyền thêm nhân viên" };
    }
    if (role === "OWNER" && caller.role !== "OWNER") {
      return { error: "Chỉ Chủ cửa hàng mới có thể gán quyền Chủ cửa hàng" };
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      const existingMember = await prisma.storeMember.findUnique({
        where: { storeId_userId: { storeId, userId: existingUser.id } },
      });
      if (existingMember) {
        return { error: "Số điện thoại (tài khoản) này đã có trong danh sách nhân viên cửa hàng" };
      }
      await prisma.storeMember.create({
        data: { storeId, userId: existingUser.id, role },
      });
      revalidateAccountPages();
      return { success: true };
    }

    const cleanEmail = email && email.length > 0 ? email : null;
    if (cleanEmail) {
      const emailExists = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (emailExists) return { error: "Email này đã được sử dụng bởi tài khoản khác" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        fullName,
        phone,
        email: cleanEmail,
        passwordHash,
        isActive: true,
        memberships: {
          create: { storeId, role },
        },
      },
    });

    revalidateAccountPages();
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const updateRoleSchema = z.object({
  storeId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
});

export async function updateStaffRoleAction(input: z.input<typeof updateRoleSchema>): Promise<ActionResult> {
  try {
    const parsed = updateRoleSchema.safeParse(input);
    if (!parsed.success) return { error: "Dữ liệu phân quyền không hợp lệ" };

    const me = await getCurrentUser();
    if (!me) return { error: "Phiên đăng nhập đã hết hạn" };

    const { storeId, memberId, role } = parsed.data;
    const caller = await prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: me.id } },
    });
    if (!caller || (caller.role !== "OWNER" && caller.role !== "MANAGER")) {
      return { error: "Bạn không có quyền phân quyền nhân viên" };
    }

    const target = await prisma.storeMember.findFirst({
      where: { id: memberId, storeId },
    });
    if (!target) return { error: "Không tìm thấy nhân viên trong cửa hàng" };
    if (target.userId === me.id) return { error: "Không thể tự thay đổi quyền của chính mình" };
    if (caller.role !== "OWNER" && (target.role === "OWNER" || role === "OWNER")) {
      return { error: "Chỉ Chủ cửa hàng mới có quyền thay đổi vai trò Chủ cửa hàng" };
    }

    await prisma.storeMember.update({
      where: { id: memberId },
      data: { role },
    });

    revalidateAccountPages();
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const removeStaffSchema = z.object({
  storeId: z.string().min(1),
  memberId: z.string().min(1),
});

export async function removeStaffAction(input: z.input<typeof removeStaffSchema>): Promise<ActionResult> {
  try {
    const parsed = removeStaffSchema.safeParse(input);
    if (!parsed.success) return { error: "Dữ liệu không hợp lệ" };

    const me = await getCurrentUser();
    if (!me) return { error: "Phiên đăng nhập đã hết hạn" };

    const { storeId, memberId } = parsed.data;
    const caller = await prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: me.id } },
    });
    if (!caller || (caller.role !== "OWNER" && caller.role !== "MANAGER")) {
      return { error: "Bạn không có quyền xóa nhân viên" };
    }

    const target = await prisma.storeMember.findFirst({
      where: { id: memberId, storeId },
    });
    if (!target) return { error: "Không tìm thấy nhân viên" };
    if (target.userId === me.id) return { error: "Không thể tự xóa tài khoản của chính mình" };
    if (target.role === "OWNER" && caller.role !== "OWNER") {
      return { error: "Chỉ Chủ cửa hàng mới có quyền xóa Chủ cửa hàng khác" };
    }

    await prisma.storeMember.delete({ where: { id: memberId } });
    revalidateAccountPages();
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
