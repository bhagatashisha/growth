import { prisma } from "@/lib/db";
import { scoreRedditMention } from "@/lib/ai/reddit-intent-scorer";

// Tavily searches Reddit directly — no Reddit API key needed.
// site:reddit.com restricts results to Reddit threads only.
const SCAN_TARGETS = [
  // Trust ICP
  { subreddit: "SaaS", keyword: `site:reddit.com/r/SaaS "security questionnaire"` },
  { subreddit: "SaaS", keyword: `site:reddit.com/r/SaaS "vendor review" enterprise` },
  { subreddit: "SaaS", keyword: `site:reddit.com/r/SaaS "SOC 2" startup` },
  { subreddit: "startups", keyword: `site:reddit.com/r/startups "compliance" enterprise B2B` },
  { subreddit: "startups", keyword: `site:reddit.com/r/startups "security review" SaaS` },
  // Revenue ICP
  { subreddit: "stripe", keyword: `site:reddit.com/r/stripe "failed payments" SaaS` },
  { subreddit: "stripe", keyword: `site:reddit.com/r/stripe "billing issue" subscription` },
  { subreddit: "SaaS", keyword: `site:reddit.com/r/SaaS "Stripe" billing subscription problem` },
  { subreddit: "startups", keyword: `site:reddit.com/r/startups "failed payments" subscription startup` },
  { subreddit: "EntrepreneurRideAlong", keyword: `site:reddit.com/r/EntrepreneurRideAlong "billing" Stripe subscription` },
];

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearchReddit(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 10,
      include_answer: false,
      days: 14, // only recent Reddit threads
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: r.content ?? "",
  }));
}

// Extract a stable ID from a Reddit URL (e.g. reddit.com/r/SaaS/comments/abc123/...)
function extractRedditPostId(url: string): string | null {
  const match = url.match(/reddit\.com\/r\/[^/]+\/comments\/([a-z0-9]+)/i);
  return match ? match[1] : null;
}

// Extract author from Reddit snippet — best-effort, falls back to "unknown"
function extractAuthor(content: string): string {
  const match = content.match(/u\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : "unknown";
}

export async function runRedditScan(): Promise<void> {
  if (!process.env.TAVILY_API_KEY) {
    console.log("[reddit-scanner] skipping — TAVILY_API_KEY not set");
    return;
  }

  console.log("[reddit-scanner] starting scan via Tavily");

  for (const target of SCAN_TARGETS) {
    const { subreddit, keyword } = target;
    const startedAt = Date.now();
    let postsFound = 0;
    let newPosts = 0;
    let errorMsg: string | null = null;

    try {
      const results = await tavilySearchReddit(keyword);
      // Only keep actual Reddit post URLs (skip subreddit home pages etc.)
      const postResults = results.filter((r) => extractRedditPostId(r.url));
      postsFound = postResults.length;

      if (postResults.length > 0) {
        // Bulk dedup
        const allIds = postResults.map((r) => extractRedditPostId(r.url)!);
        const existing = await prisma.redditMention.findMany({
          where: { redditPostId: { in: allIds } },
          select: { redditPostId: true },
        });
        const existingIds = new Set(existing.map((e) => e.redditPostId));
        const freshResults = postResults.filter((r) => !existingIds.has(extractRedditPostId(r.url)!));
        newPosts = freshResults.length;

        for (const result of freshResults) {
          const postId = extractRedditPostId(result.url)!;
          const author = extractAuthor(result.content);

          let mention;
          try {
            mention = await prisma.redditMention.create({
              data: {
                redditPostId: postId,
                subreddit,
                title: result.title,
                body: result.content,
                url: result.url,
                author,
                createdUtc: 0, // Tavily doesn't provide a Unix timestamp
                status: "unscored",
              },
            });
          } catch {
            continue; // duplicate race
          }

          // Score immediately — Tavily already fetched the content, no extra API call needed
          try {
            await scoreRedditMention(mention.id);
          } catch (err) {
            console.error(`[reddit-scanner] scoring failed for ${postId}:`, err instanceof Error ? err.message : err);
          }
        }
      }

      // Update scan state cursor (timestamp-based for Tavily, no Reddit cursor)
      await prisma.redditScanState.upsert({
        where: { subreddit_keyword: { subreddit, keyword } },
        create: { subreddit, keyword, consecutiveErrors: 0 },
        update: { lastScannedAt: new Date(), consecutiveErrors: 0 },
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[reddit-scanner] error on "${keyword}":`, errorMsg);

      const updated = await prisma.redditScanState.upsert({
        where: { subreddit_keyword: { subreddit, keyword } },
        create: { subreddit, keyword, consecutiveErrors: 1 },
        update: { consecutiveErrors: { increment: 1 }, lastScannedAt: new Date() },
      });

      if (updated.consecutiveErrors >= 3) {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "growth@korrali.com",
              to: "bhagat.ashish.a@gmail.com",
              subject: `[Reddit Scout] 3 consecutive failures: r/${subreddit}`,
              text: `Reddit scanner failed 3 times.\n\nKeyword: ${keyword}\nError: ${errorMsg}`,
            }),
          }).catch(() => {});
        }
      }
    }

    await prisma.redditScanLog.create({
      data: { subreddit, keyword, postsFound, newPosts, error: errorMsg, durationMs: Date.now() - startedAt },
    });

    console.log(`[reddit-scanner] r/${subreddit} found=${postsFound} new=${newPosts}${errorMsg ? ` err=${errorMsg}` : ""}`);
  }

  console.log("[reddit-scanner] scan complete");
}
