import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContentType } from "@prisma/client";

// GET /api/blog?product=TRUST|REVENUE
// Public endpoint — consumed by trust.korrali.com/blog and revenue.korrali.com/blog
export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product")?.toUpperCase();
  if (!product || !["TRUST", "REVENUE"].includes(product)) {
    return NextResponse.json({ error: "product must be TRUST or REVENUE" }, { status: 400 });
  }

  const articles = await prisma.contentDraft.findMany({
    where: { type: ContentType.BLOG_POST, product, status: "posted" },
    select: {
      id: true, slug: true, title: true, metaDescription: true,
      targetKeyword: true, postedAt: true, createdAt: true,
    },
    orderBy: { postedAt: "desc" },
  });

  return NextResponse.json(articles, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://trust.korrali.com, https://revenue.korrali.com",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
