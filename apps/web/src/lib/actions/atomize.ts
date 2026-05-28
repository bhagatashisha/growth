"use server";

import { enqueueContentGenerate } from "@/lib/queue";
import { ContentType } from "@prisma/client";

export async function atomizeContentAction(
  sourceText: string,
  types: ContentType[],
): Promise<void> {
  if (!sourceText.trim()) throw new Error("Source text is required");
  if (types.length === 0) throw new Error("Select at least one format");

  const sourceData = { sourceText, atomizedAt: new Date().toISOString() };
  for (const type of types) {
    await enqueueContentGenerate({ type, sourceData });
  }
}
