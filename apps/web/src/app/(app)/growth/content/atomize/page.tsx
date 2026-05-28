import { requireOrgContext } from "@/lib/org-context";
import { redirect } from "next/navigation";
import { atomizeContentAction } from "@/lib/actions/atomize";
import { Card, CardContent } from "@/components/ui/card";

const FORMATS = [
  { type: "LINKEDIN_POST", label: "LinkedIn post" },
  { type: "X_THREAD", label: "X / Twitter thread" },
  { type: "REDDIT_POST", label: "Reddit post (original)" },
  { type: "INDIE_HACKERS_POST", label: "Indie Hackers post" },
  { type: "BLOG_OUTLINE", label: "Blog outline" },
] as const;

async function handleAtomize(formData: FormData) {
  "use server";
  const sourceText = formData.get("sourceText") as string;
  const types = FORMATS.map((f) => f.type).filter((t) => formData.get(t) === "on");
  if (sourceText?.trim() && types.length > 0) {
    await atomizeContentAction(sourceText, types as Parameters<typeof atomizeContentAction>[1]);
  }
  redirect("/growth/content");
}

export default async function AtomizePage() {
  await requireOrgContext();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Atomize content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste any content and generate drafts for multiple formats at once.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={handleAtomize} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="sourceText" className="text-sm font-medium">
                Source content
              </label>
              <textarea
                id="sourceText"
                name="sourceText"
                rows={8}
                required
                placeholder="Paste a weekly insight, blog draft, or any content to repurpose…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Output formats</p>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map((f) => (
                  <label key={f.type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name={f.type} defaultChecked className="rounded" />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              Generate drafts
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
