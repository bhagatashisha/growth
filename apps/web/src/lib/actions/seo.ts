"use server";

import { revalidatePath } from "next/cache";
import { analyzeSeoTopics, type SeoTopic } from "@/lib/ai/seo-topic-analyzer";
import { generateSeoArticle, saveArticleDraft } from "@/lib/ai/seo-article-generator";
import { prisma } from "@/lib/db";

export async function discoverSeoTopicsAction(): Promise<SeoTopic[]> {
  return analyzeSeoTopics();
}

export async function generateSeoArticleAction(topicJson: string): Promise<void> {
  const topic = JSON.parse(topicJson) as SeoTopic;
  const body = await generateSeoArticle(topic);
  await saveArticleDraft(topic, body);
  revalidatePath("/growth/seo");
}

export async function publishArticleAction(id: string): Promise<void> {
  await prisma.contentDraft.update({
    where: { id },
    data: { status: "posted", postedAt: new Date() },
  });
  revalidatePath("/growth/seo");
}

export async function unpublishArticleAction(id: string): Promise<void> {
  await prisma.contentDraft.update({
    where: { id },
    data: { status: "draft" },
  });
  revalidatePath("/growth/seo");
}
