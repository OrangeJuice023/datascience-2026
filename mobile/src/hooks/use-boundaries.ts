import type { ApiMeta } from '@sigma/contracts';

import { fetchBoundaries, projectBoundaries, type ProjectedMap } from '@/api/geo';
import { useResource, type Resource } from '@/hooks/use-resource';

/** Projection width; the map component scales it to its box. */
const FRAME_WIDTH = 300;

/** A static file, not an API envelope: there is no server status to report beyond "it loaded". */
const STATIC_META: ApiMeta = { apiVersion: 'v1', generatedAt: '', status: 'live', isSample: false } as ApiMeta;

/** The reporting-unit polygons, projected once per API address. */
export function useBoundaries(baseUrl: string): Resource<ProjectedMap> {
  return useResource(
    async () => ({ data: projectBoundaries(await fetchBoundaries(baseUrl), FRAME_WIDTH), meta: STATIC_META }),
    [baseUrl]
  );
}
