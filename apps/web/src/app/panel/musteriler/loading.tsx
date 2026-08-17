import { SkeletonTable } from '@/components/ui/skeletons/SkeletonTable';
export default function Loading() { return <div className="p-6"><SkeletonTable rows={8} /></div>; }
