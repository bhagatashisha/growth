"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { enqueueLinkedInDraft } from "@/lib/queue";

export async function markLinkedInSentAction(id: string): Promise<void> {
  await prisma.linkedInOutreach.update({
    where: { id },
    data: { status: "SENT", connectionSentAt: new Date() },
  });
  revalidatePath("/growth/linkedin");
}

export async function markLinkedInRepliedAction(id: string): Promise<void> {
  await prisma.linkedInOutreach.update({
    where: { id },
    data: { status: "REPLIED", repliedAt: new Date() },
  });
  revalidatePath("/growth/linkedin");
}

export async function markLinkedInDeadAction(id: string): Promise<void> {
  await prisma.linkedInOutreach.update({
    where: { id },
    data: { status: "DEAD" },
  });
  revalidatePath("/growth/linkedin");
}

export async function generateLinkedInDraftsAction(): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: {
      linkedinUrl: { not: null },
      isBuyer: true,
      linkedInOutreach: null,
      company: { fitProduct: { not: "REJECT" }, fitScore: { gte: 6 } },
    },
    select: { id: true },
    take: 100,
  });

  for (const c of contacts) {
    await enqueueLinkedInDraft({ contactId: c.id });
  }

  revalidatePath("/growth/linkedin");
}
