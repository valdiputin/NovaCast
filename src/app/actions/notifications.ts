"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";

export async function markNotificationReadAction(notificationId: string) {
  const store = await getCurrentStore();
  await prisma.notification.updateMany({
    where: { id: notificationId, storeId: store.id },
    data: { isRead: true },
  });
  revalidatePath("/retail", "layout");
  revalidatePath("/food", "layout");
  revalidatePath("/warehouse", "layout");
}

export async function markAllNotificationsReadAction() {
  const store = await getCurrentStore();
  await prisma.notification.updateMany({
    where: { storeId: store.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/retail", "layout");
  revalidatePath("/food", "layout");
  revalidatePath("/warehouse", "layout");
}
