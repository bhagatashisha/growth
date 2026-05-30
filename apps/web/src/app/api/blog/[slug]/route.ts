import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContentType } from "@prisma/client";

// GET /api/blog/:slug — returns full article body
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const article = await prisma.contentDraft.findFirst({
    where: { slug, type: ContentType.BLOG_POST, status: "posted" },
    select: {
      id: true, slug: true, title: true, body: true,
      metaDescription: true, targetKeyword: true, product: true,
      postedAt: true, createdAt: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(article, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1200" },
  });
}
