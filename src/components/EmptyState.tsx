import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Use `h1` when the empty state is the page's main heading (no other h1 on the page). */
  headingLevel?: 'h1' | 'h2';
};

export function EmptyState({ title, description, action, headingLevel = 'h2' }: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className="dr-card flex flex-col items-center text-center py-12 sm:py-14 px-5 sm:px-8">
      <Heading className="font-serif text-2xl font-semibold text-[var(--color-ink)] text-balance">{title}</Heading>
      {description ? <p className="mt-2 text-[var(--color-muted)] text-balance max-w-md">{description}</p> : null}
      {action ? <div className="mt-5 flex w-full justify-center">{action}</div> : null}
    </div>
  );
}
