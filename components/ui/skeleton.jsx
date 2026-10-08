import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
