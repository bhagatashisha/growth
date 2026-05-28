import { requireOrgContext } from "@/lib/org-context";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { cancelAutoSendAction } from "@/lib/actions/outreach";

const CATEGORY_VARIANTS: Record<string, string> = {
  INTERESTED: "success",
  NOT_NOW: "warning",
  OBJECTION: "warning",
  UNSUBSCRIBE: "default",
  WRONG_PERSON: "default",
  NEGATIVE: "destructive",
  BOUNCE: "destructive",
  AUTO_REPLY: "default",
  OTHER: "default",
};

function autoSendLabel(c: {
  autoSendAt: Date | null;
  autoSendCancelledAt: Date | null;
  autoSentAt: Date | null;
}): { text: string; variant: "success" | "warning" | "default" } | null {
  if (c.autoSentAt) return { text: "Auto-sent", variant: "success" };
  if (c.autoSendCancelledAt) return { text: "Cancelled", variant: "default" };
  if (c.autoSendAt) {
    const msLeft = c.autoSendAt.getTime() - Date.now();
    if (msLeft <= 0) return { text: "Sending soon…", variant: "warning" };
    const hLeft = Math.floor(msLeft / 3_600_000);
    const mLeft = Math.floor((msLeft % 3_600_000) / 60_000);
    const countdown = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;
    return { text: `Auto-sends in ${countdown}`, variant: "warning" };
  }
  return null;
}

export default async function InboxPage() {
  await requireOrgContext();

  const classifications = await prisma.replyClassification.findMany({
    orderBy: { priority: "desc" },
    take: 100,
    include: {
      message: {
        include: {
          contact: { include: { company: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reply inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {classifications.length} replies, sorted by priority
        </p>
      </div>

      <div className="space-y-3">
        {classifications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No replies yet.
            </CardContent>
          </Card>
        )}
        {classifications.map((c) => {
          const sendLabel = autoSendLabel(c);
          const canCancel =
            c.category === "INTERESTED" &&
            !!c.autoSendAt &&
            !c.autoSendCancelledAt &&
            !c.autoSentAt &&
            c.autoSendAt.getTime() > Date.now();

          return (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={CATEGORY_VARIANTS[c.category] as never ?? "default"}>
                        {c.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">priority {c.priority}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      {sendLabel && (
                        <Badge variant={sendLabel.variant as never}>{sendLabel.text}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      {c.message.contact.email}
                      {c.message.contact.company && (
                        <span className="text-muted-foreground ml-1">
                          · {c.message.contact.company.name}
                        </span>
                      )}
                    </p>
                    {c.message.subject && (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.message.subject}</p>
                    )}
                    <p className="text-sm mt-2 text-foreground/80 line-clamp-3">{c.message.body}</p>
                  </div>
                </div>

                {c.founderDraft && (
                  <details className="mt-3" open={c.category === "INTERESTED" && !c.autoSentAt}>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {c.autoSentAt ? "Sent reply" : "Suggested reply"}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                        {c.founderDraft}
                      </p>
                      {canCancel && (
                        <form
                          action={async () => {
                            "use server";
                            await cancelAutoSendAction(c.id);
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            Cancel auto-send
                          </Button>
                        </form>
                      )}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
