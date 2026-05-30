import { prisma } from "@/lib/db";
import { enqueueFitScore } from "@/lib/queue";
import type { VisitorProcessPayload } from "@/lib/queue";

// ISPs that indicate residential/mobile connections — not company visitors
const RESIDENTIAL_ORGS = [
  "comcast", "at&t", "verizon", "spectrum", "cox", "charter", "centurylink",
  "frontier", "windstream", "optimum", "cablevision", "brighthouse", "time warner",
  "t-mobile", "sprint", "boost", "cricket", "metro pcs", "us cellular",
  "reliance jio", "airtel", "vodafone", "bsnl", "tata",
  "bt group", "sky broadband", "virgin media", "talktalk", "plusnet",
  "deutsche telekom", "orange", "free sas",
  "amazon", "google", "microsoft", "cloudflare",   // cloud infra — not company visitors
  "digitalocean", "linode", "vultr", "ovh",
  "tor-exit", "vpn", "proxy", "hosting",
];

function isResidentialOrBot(orgName: string): boolean {
  const lower = orgName.toLowerCase();
  return RESIDENTIAL_ORGS.some((r) => lower.includes(r));
}

// ipinfo.io free tier: 50k requests/month, no card needed
// Returns org field like "AS12345 Acme Corp" — we strip the AS prefix
async function lookupOrgByIp(ip: string): Promise<string | null> {
  const token = process.env.IPINFO_TOKEN; // optional — 50k/month free without token too
  const url = token
    ? `https://ipinfo.io/${ip}/json?token=${token}`
    : `https://ipinfo.io/${ip}/json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { org?: string; company?: { name?: string } };

    // Prefer company.name if present (paid tier), fall back to org field
    const raw = data.company?.name || data.org || null;
    if (!raw) return null;

    // Strip "AS12345 " prefix
    return raw.replace(/^AS\d+\s+/i, "").trim() || null;
  } catch {
    return null;
  }
}

function normalizeDomain(orgName: string): string | null {
  // Best-effort: strip legal suffixes and make a guessable domain
  // This is used only as a dedup key — not sent as email
  const cleaned = orgName
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|ag|bv|sas|srl|pvt|pte|limited|incorporated)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned.length >= 3 ? `${cleaned}.com` : null;
}

export async function processVisitor(payload: VisitorProcessPayload): Promise<void> {
  const { ip, page, referrer, utmSource, utmMedium, utmCampaign, sessionId } = payload;

  // Skip private IPs
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fd|fe80)/i.test(ip)) return;

  const orgName = payload.orgName || (await lookupOrgByIp(ip));

  // Record raw event regardless of company match
  await prisma.visitorEvent.create({
    data: { ip, orgName, page, referrer, utmSource, utmMedium, utmCampaign, sessionId },
  }).catch(() => {}); // non-critical

  if (!orgName) return;
  if (isResidentialOrBot(orgName)) return;

  const domain = normalizeDomain(orgName);
  if (!domain) return;

  // Dedup: only create one company per org per 7 days
  const recent = await prisma.visitorEvent.findFirst({
    where: {
      orgName,
      companyId: { not: null },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { companyId: true },
  });

  let companyId: string;

  if (recent?.companyId) {
    companyId = recent.companyId;
  } else {
    // Check if company already exists by domain
    const existing = await prisma.company.findUnique({
      where: { domain },
      select: { id: true },
    });

    if (existing) {
      companyId = existing.id;
    } else {
      // Create new company with acquisition source VISITOR
      const created = await prisma.company.create({
        data: {
          name: orgName,
          domain,
          website: `https://${domain}`,
          acquisitionSource: utmSource ? `VISITOR_${utmSource.toUpperCase()}` : "VISITOR",
        },
      });
      companyId = created.id;

      // Kick off fit scoring — if it qualifies, contact find + email enroll will follow automatically
      await enqueueFitScore({ companyId });

      await prisma.auditLog.create({
        data: {
          actor:    "system",
          action:   "visitor.company_created",
          entity:   "Company",
          entityId: companyId,
          metadata: { orgName, domain, page, ip },
        },
      });

      console.log(`[visitor-processor] new company: ${orgName} (${domain}) from page=${page}`);
    }
  }

  // Link this event to the company
  await prisma.visitorEvent.updateMany({
    where: { ip, orgName, companyId: null },
    data: { companyId },
  });
}
