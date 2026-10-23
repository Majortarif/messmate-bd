import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "mint" | "marigold" | "coral" | "sky" | "muted";

const TONES: Record<Tone, string> = {
  mint: "border-mint/30 bg-mint-soft text-mint",
  marigold: "border-marigold/30 bg-marigold-soft text-marigold",
  coral: "border-coral/30 bg-coral-soft text-coral",
  sky: "border-sky/30 bg-sky-soft text-sky",
  muted: "border-border bg-muted text-muted-foreground",
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const requestTone = { pending: "marigold", approved: "mint", rejected: "coral" } as const;
export const billTone = { draft: "muted", posted: "mint", void: "coral" } as const;
