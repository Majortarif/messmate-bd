import { cn } from "@/lib/utils";

/** House with a heart: a home for people living away from home. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8 shrink-0", className)} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill="#2DD4A7" />
      <path
        d="M10.5 22.2 22.6 11.9a2.2 2.2 0 0 1 2.8 0L37.5 22.2v13.3a2.5 2.5 0 0 1-2.5 2.5H13a2.5 2.5 0 0 1-2.5-2.5Z"
        fill="#04201A"
      />
      <path
        d="M24 34.5s-6.5-3.9-6.5-8.1c0-2.1 1.6-3.6 3.5-3.6 1.3 0 2.4.7 3 1.8.6-1.1 1.7-1.8 3-1.8 1.9 0 3.5 1.5 3.5 3.6 0 4.2-6.5 8.1-6.5 8.1Z"
        fill="#2DD4A7"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[1.05rem] font-semibold leading-none tracking-tight">
        MessMate<span className="text-primary"> BD</span>
      </span>
    </span>
  );
}
