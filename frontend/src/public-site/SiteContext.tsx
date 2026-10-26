import { createContext, useContext } from "react";
import type { PublicSite } from "@/types/site";

export const SiteContext = createContext<PublicSite | null>(null);

export function useSite(): PublicSite {
  const site = useContext(SiteContext);
  if (!site) throw new Error("useSite must be used inside the public site shell");
  return site;
}
