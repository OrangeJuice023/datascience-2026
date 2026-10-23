import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiMeta } from '@sigma/contracts';

import { ApiError } from '@/api/client';

/**
 * Loads one API resource and tracks its lifecycle.
 *
 * The hook keeps three things apart that are easy to conflate:
 * - `loading`: the request is in flight.
 * - `error`: the request failed; there is no data.
 * - `meta.status`: the request succeeded, but the data behind it is demo,
 *   unavailable or not connected.
 *
 * A failed refresh keeps the last good data on screen only as `stale`, with
 * the error, so the screen must say the data is old and the refresh failed.
 * When the resource itself changes (another server, another query) the old
 * data is cleared at once: it belongs to a different request.
 */

export interface Resource<T> {
  data: T | null;
  meta: ApiMeta | null;
  error: ApiError | null;
  loading: boolean;
  /** True while refreshing with data already on screen. */
  refreshing: boolean;
  /** The last refresh failed and `data` is from an earlier successful load. */
  stale: boolean;
  reload: () => void;
}

export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<{ data: T; meta: ApiMeta }>,
  deps: React.DependencyList
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const hasData = useRef(false);
  const lastNonce = useRef(nonce);
  const loaderRef = useRef(loader);

  // Keep the latest loader without reading a ref during render. This effect
  // is declared first so it runs before the fetch effect below.
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Same nonce means the deps changed (e.g. a new server URL), not a reload:
    // the data on screen answers a different request, so drop it.
    const isReload = nonce !== lastNonce.current;
    lastNonce.current = nonce;
    if (!isReload && hasData.current) {
      hasData.current = false;
      setData(null);
      setMeta(null);
      setError(null);
    }

    if (hasData.current) setRefreshing(true);
    else setLoading(true);

    loaderRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        hasData.current = true;
        setData(result.data);
        setMeta(result.meta);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.code === 'timeout') {
          setError(caught);
        } else if (caught instanceof ApiError) {
          setError(caught);
        } else {
          setError(new ApiError('internal_error', 0, 'Something went wrong while loading this data.'));
        }
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, meta, error, loading, refreshing, stale: data !== null && error !== null, reload };
}
