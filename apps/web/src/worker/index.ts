import "dotenv/config";
import { getBoss, QUEUE_NAMES } from "@/lib/queue";
import { sendOutreachStep } from "@/lib/sending/sender";
import { scoreFitForCompany } from "@/lib/ai/fit-scorer";
import { generateEmailSequence } from "@/lib/ai/email-generator";
import { classifyReply } from "@/lib/ai/reply-classifier";
import { generateCallBrief, generateCallFollowup } from "@/lib/ai/call-briefer";
import { runTrialIntervention } from "@/lib/trials/intervention-engine";
import { generateWeeklyInsights } from "@/lib/ai/weekly-insights";
import { generateContent } from "@/lib/ai/content-generator";
import { sendAutoReply } from "@/lib/sending/reply-sender";
import { discoverCompanies } from "@/lib/ai/company-discoverer";
import { findContactForCompany } from "@/lib/import/contact-finder";
import { runRedditScan } from "@/lib/reddit/scanner";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  enqueueOutreachSend,
  enqueueTrialIntervention,
  enqueueWeeklyInsights,
  enqueueCompanyDiscover,
  enqueueRedditScan,
} from "@/lib/queue";

async function main() {
  const boss = await getBoss();
  console.log("[worker] pg-boss started");

  boss.on("error", (err: Error) => {
    console.error("[worker] boss error:", err);
  });

  // Create all queues before registering workers — pg-boss requires the queue
  // row to exist before boss.work() can attach a handler to it.
  const allQueues = [
    "outreach-due-check", "weekly-insights-trigger",
    "trial-daily-check", "company-discover-trigger",
    QUEUE_NAMES.OUTREACH_SEND, QUEUE_NAMES.FIT_SCORE,
    QUEUE_NAMES.EMAIL_GENERATE, QUEUE_NAMES.REPLY_CLASSIFY,
    QUEUE_NAMES.REPLY_AUTO_SEND, QUEUE_NAMES.TRIAL_INTERVENTION,
    QUEUE_NAMES.WEEKLY_INSIGHTS, QUEUE_NAMES.CONTENT_GENERATE,
    QUEUE_NAMES.CALL_BRIEF, QUEUE_NAMES.CALL_FOLLOWUP,
    QUEUE_NAMES.COMPANY_DISCOVER, QUEUE_NAMES.CONTACT_FIND,
    "reddit-scan-trigger", QUEUE_NAMES.REDDIT_SCAN,
  ];
  for (const q of allQueues) {
    await boss.createQueue(q);
  }
  console.log("[worker] all queues registered");

  // Outreach send handler
  await boss.work<{ outreachId: string; stepNumber: number }>(
    QUEUE_NAMES.OUTREACH_SEND,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      const { outreachId, stepNumber } = job.data;
      console.log(`[worker] outreach.send ${outreachId} step ${stepNumber}`);
      await sendOutreachStep(outreachId, stepNumber);
    },
  );

  // Fit score handler
  await boss.work<{ companyId: string }>(
    QUEUE_NAMES.FIT_SCORE,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] fit.score ${job.data.companyId}`);
      await scoreFitForCompany(job.data.companyId);
    },
  );

  // Email generation handler
  await boss.work<{ outreachId: string }>(
    QUEUE_NAMES.EMAIL_GENERATE,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      const outreach = await prisma.outreach.findUnique({
        where: { id: job.data.outreachId },
        select: { contactId: true, campaignId: true },
      });
      if (!outreach) return;
      console.log(`[worker] email.generate ${job.data.outreachId}`);
      await generateEmailSequence({
        outreachId: job.data.outreachId,
        contactId: outreach.contactId,
        campaignId: outreach.campaignId,
      });
    },
  );

  // Reply classify handler
  await boss.work<{ messageId: string }>(
    QUEUE_NAMES.REPLY_CLASSIFY,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] reply.classify ${job.data.messageId}`);
      await classifyReply(job.data.messageId);
    },
  );

  // INTERESTED reply auto-send handler (fires after 2-hour window)
  await boss.work<{ classificationId: string }>(
    QUEUE_NAMES.REPLY_AUTO_SEND,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] reply.auto-send ${job.data.classificationId}`);
      await sendAutoReply(job.data.classificationId);
    },
  );

  // Contact finder handler (fires after fit score >= 7)
  await boss.work<{ companyId: string }>(
    QUEUE_NAMES.CONTACT_FIND,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] contact.find ${job.data.companyId}`);
      await findContactForCompany(job.data.companyId);
    },
  );

  // Reddit scan handler
  await boss.work(
    QUEUE_NAMES.REDDIT_SCAN,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log("[worker] reddit.scan");
      await runRedditScan();
    },
  );

  // Company discovery handler
  await boss.work<{ runId: string }>(
    QUEUE_NAMES.COMPANY_DISCOVER,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] company.discover run=${job.data.runId}`);
      await discoverCompanies(job.data.runId);
    },
  );

  // Trial intervention handler
  await boss.work<{ trialId: string; dayBucket: string }>(
    QUEUE_NAMES.TRIAL_INTERVENTION,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] trial.intervention ${job.data.trialId}`);
      await runTrialIntervention(job.data.trialId);
    },
  );

  // Call brief handler
  await boss.work<{ callId: string }>(
    QUEUE_NAMES.CALL_BRIEF,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] call.brief ${job.data.callId}`);
      await generateCallBrief(job.data.callId);
    },
  );

  // Call follow-up handler
  await boss.work<{ callId: string }>(
    QUEUE_NAMES.CALL_FOLLOWUP,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] call.followup ${job.data.callId}`);
      await generateCallFollowup(job.data.callId);
    },
  );

  // Weekly insights handler
  await boss.work<{ weekOf: string }>(
    QUEUE_NAMES.WEEKLY_INSIGHTS,
    { batchSize: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] weekly.insights ${job.data.weekOf}`);
      await generateWeeklyInsights(new Date(job.data.weekOf));
    },
  );

  // Content generation handler
  await boss.work<{ type: string; sourceData: Record<string, unknown> }>(
    QUEUE_NAMES.CONTENT_GENERATE,
    { batchSize: 1, localConcurrency: 1 },
    async ([job]) => {
      if (!job) return;
      console.log(`[worker] content.generate ${job.data.type}`);
      await generateContent(job.data.type as ContentType, job.data.sourceData);
    },
  );

  // ─── Cron job handlers ───────────────────────────────────────────────────────

  // Every 15 min: find outreaches due for sending and enqueue them
  await boss.work("outreach-due-check", async ([job]) => {
    if (!job) return;
    const due = await prisma.outreach.findMany({
      where: {
        status: { in: ["ACTIVE", "PENDING"] },
        nextSendAt: { lte: new Date() },
      },
      select: { id: true, currentStep: true },
      take: 100,
    });

    for (const o of due) {
      await enqueueOutreachSend({ outreachId: o.id, stepNumber: o.currentStep });
    }

    if (due.length > 0) {
      console.log(`[cron] outreach-due-check: enqueued ${due.length} outreaches`);
    }
  });

  // Monday 6am UTC: generate weekly insights
  await boss.work("weekly-insights-trigger", async ([job]) => {
    if (!job) return;
    const monday = new Date();
    monday.setUTCHours(0, 0, 0, 0);
    const day = monday.getUTCDay();
    monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
    await enqueueWeeklyInsights({ weekOf: monday.toISOString() });
    console.log("[cron] weekly-insights-trigger: enqueued");
  });

  // Daily 7am UTC: check HIGH/CRITICAL trials and enqueue interventions
  await boss.work("trial-daily-check", async ([job]) => {
    if (!job) return;
    const atRisk = await prisma.trial.findMany({
      where: {
        status: "ACTIVE",
        activationRisk: { in: ["HIGH", "CRITICAL"] },
      },
      select: { id: true },
    });

    const today = new Date().toISOString().slice(0, 10);
    for (const t of atRisk) {
      await enqueueTrialIntervention({ trialId: t.id, dayBucket: today });
    }

    if (atRisk.length > 0) {
      console.log(`[cron] trial-daily-check: enqueued ${atRisk.length} interventions`);
    }
  });

  // Every 6 hours: scan Reddit for ICP intent signals
  await boss.work("reddit-scan-trigger", async ([job]) => {
    if (!job) return;
    await enqueueRedditScan();
    console.log("[cron] reddit-scan-trigger: enqueued");
  });

  // Wednesday 5am UTC: discover new companies via web research
  await boss.work("company-discover-trigger", async ([job]) => {
    if (!job) return;
    const run = await prisma.discoveryRun.create({
      data: { source: "web_research" },
    });
    await enqueueCompanyDiscover({ runId: run.id });
    console.log(`[cron] company-discover-trigger: created run ${run.id}`);
  });


  await boss.schedule("outreach-due-check", "*/15 * * * *");
  await boss.schedule("weekly-insights-trigger", "0 6 * * 1");
  await boss.schedule("trial-daily-check", "0 7 * * *");
  await boss.schedule("company-discover-trigger", "0 5 * * 1-5"); // Mon-Fri 5am UTC
  await boss.schedule("reddit-scan-trigger", "0 */6 * * *"); // every 6 hours

  console.log("[worker] all handlers registered, crons scheduled");
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
