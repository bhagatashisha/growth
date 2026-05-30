import { prisma } from "@/lib/db";

// Distributes a scheduled ContentDraft when its scheduledFor time arrives.
//
// LinkedIn posts: auto-published via LinkedIn OAuth Share API if access token is set.
// Everything else (X, IH, Blog): sends a push notification via Resend so the founder
// can copy-paste — those platforms either have no free API or require manual posting.

async function notifyFounder(subject: string, text: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "growth@korrali.com",
      to: "bhagat.ashish.a@gmail.com",
      subject,
      text,
    }),
  }).catch(() => {});
}

async function postToLinkedIn(body: string): Promise<string | null> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  // Prefer company page URN (anonymous) over personal profile URN
  const authorUrn   = process.env.LINKEDIN_ORG_URN ?? process.env.LINKEDIN_PERSON_URN;

  if (!accessToken || !authorUrn) return null;

  const isOrg = authorUrn.startsWith("urn:li:organization:");

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: body },
          shareMediaCategory: "NONE",
        },
      },
      // Organization posts use "ANYONE"; personal posts use "PUBLIC"
      visibility: isOrg
        ? { "com.linkedin.ugc.MemberNetworkVisibility": "ANYONE" }
        : { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[content-distributor] LinkedIn post failed:", err);
    return null;
  }

  const data = (await res.json()) as { id?: string };
  return data.id
    ? `https://www.linkedin.com/feed/update/${data.id}/`
    : null;
}

export async function distributeContent(draftId: string): Promise<void> {
  const draft = await prisma.contentDraft.findUniqueOrThrow({ where: { id: draftId } });

  if (draft.status !== "scheduled") {
    console.log(`[content-distributor] draft ${draftId} not scheduled (status=${draft.status}), skipping`);
    return;
  }

  const platform = (draft.platform ?? "UNKNOWN").toUpperCase();

  if (platform === "LINKEDIN") {
    const postedLink = await postToLinkedIn(draft.body);

    if (postedLink) {
      await prisma.contentDraft.update({
        where: { id: draftId },
        data: { status: "posted", postedAt: new Date(), postedLink },
      });
      console.log(`[content-distributor] LinkedIn post published: ${postedLink}`);
    } else {
      // LinkedIn credentials not set or API failed — fall back to notification
      await notifyFounder(
        `[Content] LinkedIn post ready to publish`,
        `Your scheduled LinkedIn post is ready.\n\n---\n\n${draft.body}\n\n---\n\nCopy and paste this into LinkedIn.`,
      );
      await prisma.contentDraft.update({
        where: { id: draftId },
        data: { status: "approved" }, // revert to approved so it stays visible in calendar
      });
    }
  } else {
    // X, IH, Blog — notify founder with full copy
    const platformName = { X: "Twitter/X", IH: "Indie Hackers", BLOG: "Blog" }[platform] ?? platform;
    await notifyFounder(
      `[Content] ${platformName} post ready to publish`,
      `Your scheduled ${platformName} post is ready.\n\n---\n\n${draft.body}\n\n---\n\nCopy and paste this into ${platformName}.`,
    );
    await prisma.contentDraft.update({
      where: { id: draftId },
      data: { status: "posted", postedAt: new Date() },
    });
  }
}
