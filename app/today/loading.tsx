import { Skeleton } from "@/components/Skeleton";

export default function TodayLoading() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="mt-7 h-5 w-36" />
      <div className="mt-3 flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
