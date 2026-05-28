import { CLAUDE_MODELS } from "@/lib/ai/claude";

// All slots default to Haiku — keeping COGS minimal.
// Use || not ?? so empty-string env vars also fall back to the default.
export const BULK_MODEL = process.env.BULK_MODEL || CLAUDE_MODELS.cheap;
export const WRITING_MODEL = process.env.WRITING_MODEL || CLAUDE_MODELS.cheap;
export const HIGH_INTENT_MODEL = process.env.HIGH_INTENT_MODEL || CLAUDE_MODELS.cheap;
