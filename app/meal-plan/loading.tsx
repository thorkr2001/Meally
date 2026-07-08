import { Skeleton } from "@/components/Skeleton";

export default function MealPlanLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />

      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-[76px] rounded-2xl" />
        ))}
      </div>

      <Skeleton className="mt-5 h-96 rounded-[22px]" />
    </div>
  );
}
