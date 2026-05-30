import { requireOrgContext } from "@/lib/org-context";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-sm font-mono">$1</code>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="my-4">')
    .replace(/^(?!<[h|l|p])(.+)$/gm, '<p class="my-4">$1</p>');
}

export default async function SeoArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrgContext();
  const { id } = await params;

  const article = await prisma.contentDraft.findUnique({
    where: { id },
    select: {
      id: true, title: true, body: true, metaDescription: true,
      targetKeyword: true, product: true, slug: true, status: true, postedAt: true,
    },
  });

  if (!article) notFound();

  const liveUrl = article.slug
    ? `https://${article.product === "TRUST" ? "trust" : "revenue"}.korrali.com/blog/${article.slug}`
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href="/growth/seo" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to SEO
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs rounded-full border px-2.5 py-0.5 font-medium">
            {article.status}
          </span>
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              View live site ↗
            </a>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-1.5 rounded-lg border bg-muted/40 p-4 text-sm">
        <p><span className="font-medium">Product:</span> {article.product}</p>
        {article.targetKeyword && (
          <p><span className="font-medium">Keyword:</span> <span className="font-mono">{article.targetKeyword}</span></p>
        )}
        {article.metaDescription && (
          <p><span className="font-medium">Meta:</span> {article.metaDescription}</p>
        )}
      </div>

      <article
        className="leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(article.body) }}
      />
    </div>
  );
}
