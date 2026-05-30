"use server";

import { revalidatePath } from "next/cache";
import { analyzeSeoTopics, type SeoTopic } from "@/lib/ai/seo-topic-analyzer";
import { generateSeoArticle, saveArticleDraft } from "@/lib/ai/seo-article-generator";
import { prisma } from "@/lib/db";

const PROD_URL = "https://growth.korrali.com";
const isProd = process.env.APP_URL === PROD_URL;

async function publishToProd(slug: string, article: {
  title: string; body: string; metaDescription: string | null;
  targetKeyword: string | null; product: string | null; postedAt: Date;
}) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET is not set");

  const res = await fetch(`${PROD_URL}/api/internal/blog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({
      slug,
      title: article.title,
      body: article.body,
      metaDescription: article.metaDescription,
      targetKeyword: article.targetKeyword,
      product: article.product,
      postedAt: article.postedAt.toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to publish to production: ${res.status} ${text}`);
  }
}

async function unpublishFromProd(slug: string) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET is not set");

  const res = await fetch(`${PROD_URL}/api/internal/blog?slug=${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers: { "x-internal-secret": secret },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to unpublish from production: ${res.status} ${text}`);
  }
}

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
  const article = await prisma.contentDraft.findUnique({
    where: { id },
    select: {
      slug: true, title: true, body: true, metaDescription: true,
      targetKeyword: true, product: true,
    },
  });

  if (!article || !article.slug || !article.title) {
    throw new Error("Article not found or missing slug/title");
  }

  const postedAt = new Date();
  // title is guaranteed non-null by the check above; cast to satisfy TypeScript
  const title = article.title as string;

  if (isProd) {
    // On production: write directly to the local DB
    await prisma.contentDraft.update({
      where: { id },
      data: { status: "posted", postedAt },
    });
  } else {
    // On UAT: push to production DB via internal API, then mirror status locally
    await publishToProd(article.slug, { ...article, title, postedAt });
    await prisma.contentDraft.update({
      where: { id },
      data: { status: "posted", postedAt },
    });
  }

  revalidatePath("/growth/seo");
}

export async function unpublishArticleAction(id: string): Promise<void> {
  const article = await prisma.contentDraft.findUnique({
    where: { id },
    select: { slug: true },
  });

  if (!article?.slug) {
    throw new Error("Article not found or missing slug");
  }

  if (isProd) {
    await prisma.contentDraft.update({
      where: { id },
      data: { status: "draft", postedAt: null },
    });
  } else {
    await unpublishFromProd(article.slug);
    await prisma.contentDraft.update({
      where: { id },
      data: { status: "draft", postedAt: null },
    });
  }

  revalidatePath("/growth/seo");
}
