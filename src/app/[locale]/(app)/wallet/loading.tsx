import { CardSkeleton } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={7} />
      </div>
    </div>
  );
}
