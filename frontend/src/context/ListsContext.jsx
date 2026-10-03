import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listsApi } from '../api/endpoints.js';
import * as fallback from '../lib/constants.js';

const ListsContext = createContext(null);

/** Dropdown options come from the server (Instructions & Lists tab) and are cached for the session. */
export function ListsProvider({ children }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: listsApi.all,
    staleTime: 10 * 60 * 1000,
  });

  const lists = data?.data || { pipelineStage: fallback.PIPELINE_STAGES };

  return (
    <ListsContext.Provider value={{ lists, isLoading }}>
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const ctx = useContext(ListsContext);
  return ctx?.lists || {};
}
