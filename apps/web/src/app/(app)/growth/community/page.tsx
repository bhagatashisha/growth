import { requireOrgContext } from "@/lib/org-context";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markMentionPostedAction, dismissMentionAction } from "@/lib/actions/community";
import { CopyButton } from "./CopyButton";
import type { CommunitySource } from "@prisma/client";

const SOURCE_LABEL: Record<CommunitySource, string> = {
  REDDIT:        "Reddit",
  HACKERNEWS:    "Hacker News",
  INDIE_HACKERS: "Indie Hackers",
};

const SOURCE_BADGE_CLASS: Record<CommunitySource, string> = {
  REDDIT:        "bg-orange-100 text-orange-800 border-orange-200",
  HACKERNEWS:    "bg-amber-100 text-amber-800 border-amber-200",
  INDIE_HACKERS: "bg-blue-100 text-blue-800 border-blue-200",
};

export default async function CommunityPage() {
  await requireOrgContext();

  const [pending, unscored] = await Promise.all([
    prisma.communityMention.findMany({
      where: { status: "pending" },
      orderBy: { intentScore: "desc" },
      take: 60,
    }),
    prisma.communityMention.count({ where: { status: "unscored" } }),
  ]);

  const bySource = {
    REDDIT:        pending.filter((m) => m.source === "REDDIT").length,
    HACKERNEWS:    pending.filter((m) => m.source === "HACKERNEWS").length,
    INDIE_HACKERS: pending.filter((m) => m.source === "INDIE_HACKERS").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Community Scout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending.length} pending replies
            {" · "}Reddit {bySource.REDDIT}
            {" · "}HN {bySource.HACKERNEWS}
            {" · "}IH {bySource.INDIE_HACKERS}
            {unscored > 0 && <> · {unscored} unscored</>}
          </p>
        </div>
      </div>

      {unscored > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {unscored} posts collected but not yet scored. Scoring runs automatically with the next scan.
        </div>
      )}

      <div className="space-y-4">
        {pending.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No pending replies. Scanner runs daily at 8am UTC across Reddit, Hacker News, and Indie Hackers.
            </CardContent>
          </Card>
        )}

        {pending.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5 pb-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE_CLASS[m.source]}`}>
                      {SOURCE_LABEL[m.source]}
                    </span>
                    {m.subreddit && (
                      <Badge variant="outline">r/{m.subreddit}</Badge>
                    )}
                    {m.icpSignal && m.icpSignal !== "NONE" && (
                      <Badge variant="default">{m.icpSignal}</Badge>
                    )}
                    <span className="text-xs font-semibold">Score {m.intentScore}/10</span>
                    <span className="text-xs text-muted-foreground">{m.author !== "unknown" ? `u/${m.author}` : ""}</span>
                  </div>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline line-clamp-2"
                  >
                    {m.title}
                  </a>
                  {m.intentReason && (
                    <p className="text-xs text-muted-foreground">{m.intentReason}</p>
                  )}
                </div>
              </div>

              {m.replyVariants.length > 0 && (
                <ReplyVariantPicker mentionId={m.id} variants={m.replyVariants} source={m.source} />
              )}

              <div className="flex gap-2">
                <form action={dismissMentionAction.bind(null, m.id)}>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReplyVariantPicker({
  mentionId,
  variants,
  source,
}: {
  mentionId: string;
  variants: string[];
  source: CommunitySource;
}) {
  const platformLabel = SOURCE_LABEL[source];
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Reply variants — copy, paste into {platformLabel}
      </p>
      {variants.map((v, i) => (
        <div key={i} className="rounded-md border bg-muted/40 p-3 space-y-2">
          <p className="text-sm whitespace-pre-wrap">{v}</p>
          <div className="flex gap-2">
            <CopyButton text={v} />
            <MarkPostedForm mentionId={mentionId} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarkPostedForm({ mentionId }: { mentionId: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const url = formData.get("postedUrl") as string | null;
        await markMentionPostedAction(mentionId, url ?? undefined);
      }}
      className="flex gap-1"
    >
      <input
        type="url"
        name="postedUrl"
        placeholder="Comment URL (optional)"
        className="rounded-md border border-input bg-background px-2 py-1 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Mark posted
      </button>
    </form>
  );
}
