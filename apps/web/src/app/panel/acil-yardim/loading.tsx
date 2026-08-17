import { SkeletonCard } from '@/components/ui/skeletons/SkeletonCard';

export default function Loading() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}
