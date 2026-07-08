import { Skeleton } from "@/components/Skeleton";

export default function PlanReviewLoading() {
  return (
    <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-24 rounded-2xl" />
      <Skeleton className="mt-6 h-40 rounded-2xl" />
    </div>
  );
}
