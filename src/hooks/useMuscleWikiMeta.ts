import { useQuery } from '@tanstack/react-query';
import { getMuscleWikiMeta } from '../lib/musclewiki';

/** Categories and muscles (cached 30 days, as MuscleWiki's terms allow). Also tells whether the proxy answers. */
export function useMuscleWikiMeta(enabled: boolean) {
  return useQuery({
    queryKey: ['musclewiki', 'meta'],
    queryFn: ({ signal }) => getMuscleWikiMeta(signal),
    enabled,
    retry: false,
    staleTime: 30 * 24 * 60 * 60 * 1000,
  });
}
