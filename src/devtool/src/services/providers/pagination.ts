import type { PageInfo, PageRequest, PageResult } from './types';

export function normalizePageRequest(
  request: Partial<PageRequest>,
  defaults: PageRequest,
  maximumLimit: number,
): PageRequest {
  const limit = Math.min(maximumLimit, Math.max(1, Math.trunc(request.limit ?? defaults.limit) || defaults.limit));
  const offset = Math.max(0, Math.trunc(request.offset ?? defaults.offset) || 0);
  return { limit, offset };
}

export function pageInfo(request: PageRequest, returned: number, truncated = false): PageInfo {
  const hasMore = !truncated && returned === request.limit;
  return {
    ...request,
    returned,
    nextOffset: hasMore ? request.offset + returned : null,
    hasMore,
    truncated,
  };
}

export function mergePageByKey<T>(
  current: readonly T[],
  incoming: readonly T[],
  keyOf: (item: T) => string,
): T[] {
  const merged = new Map(current.map((item) => [keyOf(item), item]));
  incoming.forEach((item) => merged.set(keyOf(item), item));
  return [...merged.values()];
}

export async function fetchAllPages<T>(
  first: PageRequest,
  fetchPage: (page: PageRequest) => Promise<PageResult<T>>,
  options: { maxPages: number; keyOf: (item: T) => string },
): Promise<PageResult<T>> {
  let request = first;
  let items: T[] = [];
  let lastPage = pageInfo(first, 0);

  for (let index = 0; index < options.maxPages; index += 1) {
    const result = await fetchPage(request);
    items = mergePageByKey(items, result.items, options.keyOf);
    lastPage = result.page;
    if (!result.page.hasMore || result.page.nextOffset === null) {
      return { items, page: { ...result.page, returned: items.length } };
    }
    request = { limit: request.limit, offset: result.page.nextOffset };
  }

  return { items, page: { ...lastPage, returned: items.length, nextOffset: null, hasMore: false, truncated: true } };
}
