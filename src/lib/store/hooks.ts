"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { qaStore, type QaState } from "./qa-store";

export function useQaState(): QaState {
  return useSyncExternalStore(qaStore.subscribe, qaStore.getSnapshot, qaStore.getServerSnapshot);
}

interface ImageUrlState {
  id: string | undefined;
  url: string | null;
  failed: boolean;
}

/** Object URL for a stored image blob; released automatically on unmount. */
export function useImageUrl(id: string | undefined): { url: string | null; failed: boolean } {
  const [state, setState] = useState<ImageUrlState>({ id: undefined, url: null, failed: false });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    qaStore.acquireImageUrl(id).then((url) => {
      if (alive) setState({ id, url, failed: !url });
    });
    return () => {
      alive = false;
      qaStore.releaseImageUrl(id);
    };
  }, [id]);

  return state.id === id ? state : { url: null, failed: false };
}
