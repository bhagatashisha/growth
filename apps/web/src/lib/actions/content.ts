"use server";

import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ContentType } from "@prisma/client";
import { enqueueContentGenerate } from "@/lib/queue";
import { revalidatePath } from "next/cache";

export async function generateContentAction(
  type: ContentType,
  sourceData: Record<string, unknown>,
): Promise<void> {
  await requireRole("MEMBER");
  await enqueueContentGenerate({ type, sourceData });
}

export async function approveContentAction(draftId: string): Promise<void> {
  await requireRole("MEMBER");
  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "approved" },
  });
  revalidatePath("/growth/content");
}

export async function scheduleContentAction(
  draftId: string,
  platform: string,
  scheduledForIso: string,
): Promise<void> {
  await requireRole("MEMBER");
  const scheduledFor = new Date(scheduledForIso);
  if (isNaN(scheduledFor.getTime())) throw new Error("Invalid date");
  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "scheduled", platform, scheduledFor },
  });
  revalidatePath("/growth/content");
}

export async function markContentPostedAction(draftId: string, postedLink?: string): Promise<void> {
  await requireRole("MEMBER");
  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "posted", postedAt: new Date(), postedLink: postedLink || null },
  });
  revalidatePath("/growth/content");
}

export async function unscheduleContentAction(draftId: string): Promise<void> {
  await requireRole("MEMBER");
  await prisma.contentDraft.update({
    where: { id: draftId },
    data: { status: "approved", scheduledFor: null, platform: null },
  });
  revalidatePath("/growth/content");
}
