import { requireOrgContext } from "@/lib/org-context";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markPostedAction, dismissMentionAction } from "@/lib/actions/reddit";
import { CopyButton } from "./CopyButton";

export default async function RedditPage() {
  await requireOrgContext();

  const pending = await prisma.redditMention.findMany({
    where: { status: "pending" },
    orderBy: { intentScore: "desc" },
    take: 50,
  });

  const unscored = await prisma.redditMention.count({ where: { status: "unscored" } });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reddit Scout</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending.length} pending replies · {unscored} unscored posts
          </p>
        </div>
      </div>

      {unscored > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {unscored} posts collected but not yet scored. Run the intent scorer to generate reply drafts.
        </div>
      )}

      <div className="space-y-4">
        {pending.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No pending replies. Run the Reddit scanner to collect new posts.
            </CardContent>
          </Card>
        )}

        {pending.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5 pb-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">r/{m.subreddit}</Badge>
                    {m.icpSignal && m.icpSignal !== "NONE" && (
                      <Badge variant="default">{m.icpSignal}</Badge>
                    )}
                    <span className="text-xs font-semibold">Score {m.intentScore}/10</span>
                    <span className="text-xs text-muted-foreground">u/{m.author}</span>
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
                <ReplyVariantPicker mentionId={m.id} variants={m.replyVariants} />
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
}: {
  mentionId: string;
  variants: string[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Reply variants — pick one, copy, paste from burner account
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
        await markPostedAction(mentionId, url ?? undefined);
      }}
      className="flex gap-1"
    >
      <input
        type="url"
        name="postedUrl"
        placeholder="Reddit comment URL (optional)"
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
