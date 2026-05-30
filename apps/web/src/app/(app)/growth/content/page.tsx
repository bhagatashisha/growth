import { requireOrgContext } from "@/lib/org-context";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  approveContentAction,
  scheduleContentAction,
  markContentPostedAction,
  unscheduleContentAction,
} from "@/lib/actions/content";
import Link from "next/link";

const PLATFORM_OPTIONS = ["LINKEDIN", "X", "IH", "BLOG"] as const;
type Platform = typeof PLATFORM_OPTIONS[number];

const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  X:        "Twitter/X",
  IH:       "Indie Hackers",
  BLOG:     "Blog",
};

const STATUS_VARIANT: Record<string, "default" | "outline" | "warning"> = {
  draft:     "warning",
  approved:  "default",
  scheduled: "outline",
  posted:    "outline",
};

export default async function ContentPage() {
  await requireOrgContext();

  const [scheduled, approved, drafts, posted] = await Promise.all([
    prisma.contentDraft.findMany({
      where: { status: "scheduled" },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.contentDraft.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentDraft.findMany({
      where: { status: "draft" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.contentDraft.findMany({
      where: { status: "posted" },
      orderBy: { postedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scheduled.length} scheduled · {approved.length} approved · {drafts.length} drafts · {posted.length} posted
          </p>
        </div>
        <Link
          href="/growth/content/atomize"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Atomize content
        </Link>
      </div>

      {/* Scheduled */}
      {scheduled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</h2>
          {scheduled.map((d) => (
            <Card key={d.id} className="border-blue-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">{d.type}</Badge>
                      {d.platform && <Badge variant="outline">{d.platform}</Badge>}
                      <span className="text-xs font-medium text-blue-700">
                        {d.scheduledFor ? formatDate(d.scheduledFor) : "—"}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-4">{d.body}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <form action={markContentPostedAction.bind(null, d.id, undefined)}>
                      <Button type="submit" size="sm" variant="outline">Mark posted</Button>
                    </form>
                    <form action={unscheduleContentAction.bind(null, d.id)}>
                      <Button type="submit" size="sm" variant="ghost">Unschedule</Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Approved — ready to schedule */}
      {approved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Approved — schedule these</h2>
          {approved.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{d.type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-4">{d.body}</p>
                <ScheduleForm draftId={d.id} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Drafts</h2>
          {drafts.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">{d.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-4">{d.body}</p>
                  </div>
                  <form action={approveContentAction.bind(null, d.id)}>
                    <Button type="submit" variant="outline" size="sm">Approve</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Posted */}
      {posted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Posted</h2>
          {posted.map((d) => (
            <Card key={d.id} className="opacity-60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{d.type}</Badge>
                  {d.platform && <Badge variant="outline">{d.platform}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {d.postedAt ? formatDate(d.postedAt) : ""}
                  </span>
                  {d.postedLink && (
                    <a href={d.postedLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">View post</a>
                  )}
                </div>
                <p className="text-sm text-foreground/70 line-clamp-2">{d.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {scheduled.length === 0 && approved.length === 0 && drafts.length === 0 && posted.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No content yet. Generate from Settings or use Atomize content.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScheduleForm({ draftId }: { draftId: string }) {
  return (
    <form
      action={async (fd: FormData) => {
        "use server";
        const platform = fd.get("platform") as string;
        const scheduledFor = fd.get("scheduledFor") as string;
        if (!platform || !scheduledFor) return;
        await scheduleContentAction(draftId, platform, new Date(scheduledFor).toISOString());
      }}
      className="flex flex-wrap gap-2 items-center"
    >
      <select
        name="platform"
        required
        className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Platform…</option>
        {PLATFORM_OPTIONS.map((p) => (
          <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
        ))}
      </select>
      <input
        type="datetime-local"
        name="scheduledFor"
        required
        className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Schedule
      </button>
    </form>
  );
}
