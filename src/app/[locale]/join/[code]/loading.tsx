import { CardSkeleton } from "@/components/shared/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <CardSkeleton lines={5} />
    </div>
  );
}
