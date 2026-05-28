"use client";

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
    >
      Copy
    </button>
  );
}
