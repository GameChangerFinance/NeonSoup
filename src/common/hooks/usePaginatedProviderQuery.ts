import { useEffect, useRef, useState } from 'react';
import { mergePageByKey } from '../services/providers/pagination';
import type { PageRequest, PageResult } from '../services/providers/types';

interface PaginatedQueryState<T> {
  items: T[];
  page: PageResult<T>['page'] | null;
  loadingInitial: boolean;
  loadingMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchMore: () => Promise<void>;
}

export function usePaginatedProviderQuery<T>(
  queryKey: readonly unknown[],
  firstPage: PageRequest,
  fetchPage: (page: PageRequest, signal: AbortSignal) => Promise<PageResult<T>>,
  keyOf: (item: T) => string,
): PaginatedQueryState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState<PageResult<T>['page'] | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stableKey = JSON.stringify(queryKey);

  async function load(request: PageRequest, append: boolean): Promise<void> {
    if (append && loadingMore) return;
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    const activeGeneration = generation.current;
    append ? setLoadingMore(true) : setLoadingInitial(true);
    setError(null);
    try {
      const result = await fetchPage(request, activeController.signal);
      if (activeGeneration !== generation.current) return;
      setItems((current) => (append ? mergePageByKey(current, result.items, keyOf) : result.items));
      setPage(result.page);
    } catch (loadError) {
      if (!activeController.signal.aborted) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load page.');
      }
    } finally {
      if (activeGeneration === generation.current) {
        append ? setLoadingMore(false) : setLoadingInitial(false);
      }
    }
  }

  async function refresh(): Promise<void> {
    generation.current += 1;
    setItems([]);
    setPage(null);
    await load(firstPage, false);
  }

  async function fetchMore(): Promise<void> {
    if (!page?.hasMore || page.nextOffset === null) return;
    await load({ limit: page.limit, offset: page.nextOffset }, true);
  }

  useEffect(() => {
    void refresh();
    return () => controller.current?.abort();
    // The serialized key intentionally defines remote query identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey, firstPage.limit, firstPage.offset]);

  return { items, page, loadingInitial, loadingMore, error, refresh, fetchMore };
}
