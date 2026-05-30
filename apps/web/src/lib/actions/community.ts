"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markMentionPostedAction(id: string, postedUrl?: string): Promise<void> {
  await prisma.communityMention.update({
    where: { id },
    data: {
      status:          "posted",
      postedManuallyAt: new Date(),
      postedUrl:        postedUrl || null,
    },
  });
  revalidatePath("/growth/community");
}

export async function dismissMentionAction(id: string): Promise<void> {
  await prisma.communityMention.update({
    where: { id },
    data: { status: "dismissed", dismissedAt: new Date() },
  });
  revalidatePath("/growth/community");
}
