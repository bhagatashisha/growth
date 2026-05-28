"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markPostedAction(id: string, postedUrl?: string): Promise<void> {
  await prisma.redditMention.update({
    where: { id },
    data: {
      status: "posted",
      postedManuallyAt: new Date(),
      postedUrl: postedUrl || null,
    },
  });
  revalidatePath("/growth/reddit");
}

export async function dismissMentionAction(id: string): Promise<void> {
  await prisma.redditMention.update({
    where: { id },
    data: { status: "dismissed", dismissedAt: new Date() },
  });
  revalidatePath("/growth/reddit");
}
