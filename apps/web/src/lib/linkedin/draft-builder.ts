import { prisma } from "@/lib/db";
import { generateLinkedInCopy } from "@/lib/ai/linkedin-generator";

export async function buildLinkedInDraft(contactId: string): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { company: true },
  });

  if (!contact.linkedinUrl) return;
  if (!contact.isBuyer) return;
  // Skip competitors and unscored companies — only generate drafts for confirmed fits
  if (!contact.company || contact.company.fitProduct === "REJECT") return;
  if (!contact.company.fitScore || contact.company.fitScore < 6) return;

  // Idempotent — skip if draft already exists
  const existing = await prisma.linkedInOutreach.findUnique({
    where: { contactId },
    select: { id: true },
  });
  if (existing) return;

  const copy = await generateLinkedInCopy({
    firstName:          contact.firstName ?? "there",
    lastName:           contact.lastName ?? "",
    title:              contact.title ?? "",
    companyName:        contact.company?.name ?? "",
    companyDescription: contact.company?.description,
    industry:           contact.company?.industry,
    fitProduct:         contact.company?.fitProduct ?? null,
    painHypothesis:     contact.company?.painHypothesis,
    trigger:            contact.company?.trigger,
  });

  await prisma.linkedInOutreach.create({
    data: {
      contactId,
      connectionNoteDraft: copy.connectionNote,
      messageDraft:        copy.firstMessage,
      status:              "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      actor:    "system",
      action:   "linkedin.draft.created",
      entity:   "LinkedInOutreach",
      entityId: contactId,
      metadata: { companyName: contact.company?.name ?? "" },
    },
  });

  console.log(`[linkedin-draft-builder] created draft for ${contact.email} (${contact.company?.name})`);
}
