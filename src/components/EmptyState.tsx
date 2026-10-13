import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="yp-card flex flex-col items-center text-center py-12 sm:py-14 px-5 sm:px-8">
      <h2 className="font-serif text-2xl font-semibold text-[var(--color-ink)] text-balance">{title}</h2>
      {description ? <p className="mt-2 text-[var(--color-muted)] text-balance max-w-md">{description}</p> : null}
      {action ? <div className="mt-5 flex w-full justify-center">{action}</div> : null}
    </div>
  );
}
