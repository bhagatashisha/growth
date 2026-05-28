import { prisma } from "@/lib/db";
import { anthropic, CLAUDE_MODELS } from "@/lib/ai/claude";
import { BULK_MODEL } from "@/lib/ai/models";
import { FitProduct } from "@prisma/client";
import { enqueueFitScore, enqueueContactFind } from "@/lib/queue";

const CONTACT_FIND_THRESHOLD = 6;

export interface FitScoreResult {
  fitProduct: FitProduct;
  fitScore: number;
  painHypothesis: string;
  trigger: string;
  personalizedObservation: string;
  recommendedCta: string;
  fitReasoning: string;
}

const SYSTEM_PROMPT = `You are an ICP fit scorer for two B2B SaaS products:

**Korrali Trust** — Compliance and trust workspace for B2B SaaS companies (10–500 employees). Helps companies answer security/privacy questionnaires from prospects, generate SOC2/ISO27001 policy docs, manage vendor reviews, and publish a public trust page.

Good fit (score 6–10): Any B2B SaaS that sells to enterprise OR mid-market (100+ employee buyers). The company doesn't need to be AI-native — any SaaS product used by large companies faces questionnaires. Stronger signals: named enterprise/mid-market customers on their website, an "enterprise" pricing tier, a careers page showing they're hiring sales engineers or solutions engineers, recent funding (seed to series B), building integrations for enterprise tools (SSO, SAML, SCIM, Salesforce). Even stronger: mentions of SOC2 in progress, security page exists but is thin, no trust center yet.

Weak fit / REJECT: direct competitors (Vanta, Drata, Secureframe, Scrut, TrustCloud, Tugboat Logic, Sprinto — these ARE compliance tools, not buyers), consumer apps, marketplaces, agencies, non-software businesses, companies that already have a mature trust center.

**Korrali Revenue** — Subscription billing health monitoring for SaaS companies. Detects failed payments, revenue leakage, duplicate charges, and billing anomalies. Works with Stripe; also useful for companies on Paddle, Chargebee, or Recurly.

Good fit (score 6–10): Any subscription SaaS generating revenue. Stronger signals: subscription or usage-based pricing model, engineering team is small relative to customer base (billing is deprioritised), scaling MRR (any stage from post-revenue seed to series B), Stripe mentioned in tech stack or job postings, no dedicated billing ops or RevOps hire, has multiple pricing tiers or seats-based billing.

Weak fit / REJECT: non-subscription businesses (one-time purchase, services, agencies), companies with dedicated billing engineering teams, enterprise companies with custom invoicing only.

BOTH: if a company clearly fits both products, use BOTH.

Score 1–5 = weak or no fit (REJECT unless clearly 5). Score 6–7 = decent fit, worth outreach. Score 8–10 = strong fit, high priority.

Respond with valid JSON only. No prose before or after the JSON.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    fitProduct: { type: "string", enum: ["TRUST", "REVENUE", "BOTH", "REJECT"] },
    fitScore: { type: "number", description: "1-10, where 10 = perfect ICP match" },
    painHypothesis: { type: "string", description: "One sentence: the specific pain this company is feeling right now" },
    trigger: { type: "string", description: "The observable signal that makes this the right time to reach out" },
    personalizedObservation: { type: "string", description: "One verifiable, specific thing noticed about this company from public signals" },
    recommendedCta: { type: "string", description: "The best CTA to use: demo, quick call, or soft question" },
    fitReasoning: { type: "string", description: "2-3 sentences explaining the fit score and product choice" },
  },
  required: ["fitProduct", "fitScore", "painHypothesis", "trigger", "personalizedObservation", "recommendedCta", "fitReasoning"],
  additionalProperties: false,
};

export async function scoreFitForCompany(companyId: string): Promise<FitScoreResult> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const startedAt = Date.now();
  const inputData = {
    name: company.name,
    domain: company.domain,
    website: company.website,
    description: company.description,
    industry: company.industry,
    employeeCount: company.employeeCount,
    detectedTechs: company.detectedTechs,
  };

  let outputData: FitScoreResult | null = null;
  let error: string | null = null;

  try {
    const response = await anthropic.messages.create({
      model: BULK_MODEL,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Score this company:\n${JSON.stringify(inputData, null, 2)}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No text block in response");

    const parsed = JSON.parse(block.text) as FitScoreResult;

    // Validate enum
    if (!Object.values(FitProduct).includes(parsed.fitProduct as FitProduct)) {
      throw new Error(`Invalid fitProduct: ${parsed.fitProduct}`);
    }
    if (parsed.fitScore < 1 || parsed.fitScore > 10) {
      throw new Error(`fitScore out of range: ${parsed.fitScore}`);
    }

    outputData = parsed;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await prisma.scoringRun.create({
      data: {
        companyId,
        model: BULK_MODEL,
        inputData: JSON.parse(JSON.stringify(inputData)),
        outputData: outputData ? JSON.parse(JSON.stringify(outputData)) : undefined,
        error,
        durationMs: Date.now() - startedAt,
      },
    });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      fitProduct: outputData!.fitProduct as FitProduct,
      fitScore: outputData!.fitScore,
      painHypothesis: outputData!.painHypothesis,
      trigger: outputData!.trigger,
      personalizedObservation: outputData!.personalizedObservation,
      recommendedCta: outputData!.recommendedCta,
      fitReasoning: outputData!.fitReasoning,
      fitScoredAt: new Date(),
    },
  });

  // Auto-trigger contact discovery for high-fit companies
  if (
    outputData!.fitScore >= CONTACT_FIND_THRESHOLD &&
    outputData!.fitProduct !== "REJECT"
  ) {
    await enqueueContactFind({ companyId });
  }

  return outputData!;
}

export async function bulkScoreCompanies(companyIds: string[]): Promise<void> {
  for (const id of companyIds) {
    await enqueueFitScore({ companyId: id });
  }
}
