import { CardSkeleton } from "@/components/shared/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <CardSkeleton lines={10} />
    </div>
  );
}
