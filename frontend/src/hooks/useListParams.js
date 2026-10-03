import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list state (search, view, filters, paging) in the URL so a filtered
 * screen can be bookmarked, shared, and survives a refresh or back-navigation.
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const obj = { ...defaults };
    for (const [key, value] of searchParams.entries()) obj[key] = value;
    return obj;
  }, [searchParams, defaults]);

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value === null || value === undefined || value === 'all') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page'); // any filter change returns to page 1
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setMany = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === '' || value === null || value === undefined || value === 'all') next.delete(key);
        else next.set(key, value);
      }
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback((keep = ['search', 'view']) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      for (const key of keep) if (prev.get(key)) next.set(key, prev.get(key));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { params, setParam, setMany, clearFilters };
}
