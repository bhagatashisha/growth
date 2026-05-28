import { prisma } from "@/lib/db";
import { anthropic } from "@/lib/ai/claude";
import { BULK_MODEL } from "@/lib/ai/models";

const SYSTEM_PROMPT = `You are scoring Reddit posts for intent signals relevant to two B2B SaaS products:

**Korrali Trust** — Helps B2B SaaS companies answer security/privacy questionnaires, generate compliance docs, and publish a trust page.

**Korrali Revenue** — Detects failed payments, billing anomalies, and revenue leakage for subscription SaaS companies.

Score 1–10 how likely the post author needs one of these products RIGHT NOW based on their post.

If score >= 7, also write 3 distinct reply comment variations:
- Each 2-4 sentences
- Address the OP directly (use their username as u/{author} or reference their specific situation)
- Each variation takes a different angle (analogy / concrete step / clarifying question)
- Never name Korrali or include product links
- One variation may end with "happy to share how we solved this — DM me"

Respond with valid JSON only.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    intentScore: { type: "number", description: "1-10 intent signal strength" },
    intentReason: { type: "string", description: "Why this post signals intent" },
    icpSignal: { type: "string", enum: ["TRUST", "REVENUE", "BOTH", "NONE"] },
    replyVariants: {
      type: "array",
      items: { type: "string" },
      description: "3 reply variations if intentScore >= 7, empty array otherwise",
    },
  },
  required: ["intentScore", "intentReason", "icpSignal", "replyVariants"],
  additionalProperties: false,
};

export interface IntentScoreResult {
  intentScore: number;
  intentReason: string;
  icpSignal: string;
  replyVariants: string[];
}

export async function scoreRedditMention(mentionId: string): Promise<IntentScoreResult> {
  const mention = await prisma.redditMention.findUniqueOrThrow({ where: { id: mentionId } });

  const inputData = {
    title: mention.title,
    body: mention.body,
    author: mention.author,
    subreddit: mention.subreddit,
  };

  const response = await anthropic.messages.create({
    model: BULK_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Score this Reddit post:\n${JSON.stringify(inputData, null, 2)}`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text block in response");

  const result = JSON.parse(block.text) as IntentScoreResult;

  if (result.intentScore < 1 || result.intentScore > 10) {
    throw new Error(`intentScore out of range: ${result.intentScore}`);
  }
  // Ensure exactly 3 variants when score is high, empty when low
  if (result.intentScore >= 7 && result.replyVariants.length !== 3) {
    throw new Error(`Expected 3 replyVariants for score ${result.intentScore}, got ${result.replyVariants.length}`);
  }

  await prisma.redditMention.update({
    where: { id: mentionId },
    data: {
      intentScore: result.intentScore,
      intentReason: result.intentReason,
      icpSignal: result.icpSignal,
      replyVariants: result.replyVariants,
      status: result.intentScore >= 7 ? "pending" : "dismissed",
    },
  });

  return result;
}

export async function scoreUnscoredMentions(): Promise<void> {
  const unscored = await prisma.redditMention.findMany({
    where: { status: "unscored" },
    select: { id: true, title: true },
    orderBy: { scannedAt: "asc" },
    take: 100,
  });

  console.log(`[reddit-scorer] scoring ${unscored.length} unscored mentions`);
  for (const m of unscored) {
    try {
      const result = await scoreRedditMention(m.id);
      console.log(`[reddit-scorer] ✓ "${m.title.slice(0, 60)}" score=${result.intentScore} icp=${result.icpSignal}`);
    } catch (err) {
      console.error(`[reddit-scorer] ✗ ${m.id}:`, err instanceof Error ? err.message : err);
    }
  }
}
