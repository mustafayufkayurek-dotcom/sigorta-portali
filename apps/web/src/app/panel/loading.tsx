import { SkeletonCard } from '@/components/ui/skeletons/SkeletonCard';
import { SkeletonTable } from '@/components/ui/skeletons/SkeletonTable';

export default function PanelLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
