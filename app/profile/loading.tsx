import { Skeleton } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-28" />

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-[20px]" />
        <Skeleton className="h-20 rounded-[20px]" />
      </div>

      <Skeleton className="mt-3.5 h-40 rounded-[20px]" />
      <Skeleton className="mt-3.5 h-48 rounded-[20px]" />
      <Skeleton className="mt-3.5 h-16 rounded-2xl" />
    </div>
  );
}
