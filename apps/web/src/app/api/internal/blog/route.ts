import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContentType } from "@prisma/client";

// Internal API — called by UAT (and prod itself) to publish/unpublish articles
// into the production database. Protected by INTERNAL_API_SECRET.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return req.headers.get("x-internal-secret") === secret;
}

// POST /api/internal/blog — publish an article (upsert by slug)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    slug: string;
    title: string;
    body: string;
    metaDescription?: string | null;
    targetKeyword?: string | null;
    product: string;
    postedAt: string;
  };

  if (!body.slug || !body.title || !body.body || !body.product) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await prisma.contentDraft.upsert({
    where: { slug: body.slug },
    create: {
      type: ContentType.BLOG_POST,
      slug: body.slug,
      title: body.title,
      body: body.body,
      metaDescription: body.metaDescription ?? null,
      targetKeyword: body.targetKeyword ?? null,
      product: body.product,
      status: "posted",
      postedAt: new Date(body.postedAt),
    },
    update: {
      title: body.title,
      body: body.body,
      metaDescription: body.metaDescription ?? null,
      targetKeyword: body.targetKeyword ?? null,
      status: "posted",
      postedAt: new Date(body.postedAt),
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/internal/blog?slug=xxx — unpublish an article
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  await prisma.contentDraft.updateMany({
    where: { slug, type: ContentType.BLOG_POST },
    data: { status: "draft", postedAt: null },
  });

  return NextResponse.json({ ok: true });
}
