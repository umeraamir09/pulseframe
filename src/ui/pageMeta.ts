import { createContext, useContext, useEffect } from "react";

export interface PageMeta {
  title: string;
  subtitle?: string;
}

export const PageMetaContext = createContext<(meta: PageMeta) => void>(() => {});

/** Sets the title and subtitle shown in the shell header while the page is mounted. */
export function usePageMeta(title: string, subtitle?: string): void {
  const set = useContext(PageMetaContext);
  useEffect(() => {
    set({ title, subtitle });
    document.title = `${title} · Pulseframe`;
  }, [set, title, subtitle]);
}
