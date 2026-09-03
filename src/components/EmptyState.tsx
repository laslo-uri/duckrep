import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 sm:py-16 px-4 border border-dashed border-[var(--color-border)] rounded-2xl">
      <h2 className="font-serif text-lg font-semibold text-[var(--color-ink)] mb-2">{title}</h2>
      {description ? <p className="text-[var(--color-muted)] mb-4">{description}</p> : null}
      {action}
    </div>
  );
}
