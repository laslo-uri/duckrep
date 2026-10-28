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
    <div className="flex flex-col items-center rounded-lg border border-dashed border-[var(--color-line-strong)] px-5 py-10 text-center sm:px-8">
      <Heading className="text-[15px] font-semibold text-[var(--color-ink)] text-balance">{title}</Heading>
      {description ? <p className="mt-1 text-[13px] text-[var(--color-muted)] text-balance max-w-md">{description}</p> : null}
      {action ? <div className="mt-4 flex w-full justify-center">{action}</div> : null}
    </div>
  );
}
