import { NextRequest, NextResponse } from "next/server";
import { enqueueVisitorProcess } from "@/lib/queue";

// Receives beacons from trust.korrali.com + revenue.korrali.com tracking script.
// Enqueues async processing — never blocks the browser request.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      page?: string;
      referrer?: string;
      utm?: Record<string, string>;
      sessionId?: string;
    };

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (!body.page) return new NextResponse(null, { status: 204 });

    await enqueueVisitorProcess({
      ip,
      page:        body.page,
      referrer:    body.referrer,
      utmSource:   body.utm?.utm_source,
      utmMedium:   body.utm?.utm_medium,
      utmCampaign: body.utm?.utm_campaign,
      sessionId:   body.sessionId,
    });
  } catch {
    // Silently absorb all errors — this is a fire-and-forget beacon endpoint
  }

  return new NextResponse(null, { status: 204 });
}

// Allow cross-origin from trust + revenue domains
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
