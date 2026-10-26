import { setRefreshHandler } from "./apiClient";
import { authApi } from "./authApi";
import { setAccessToken } from "./tokenStore";

/**
 * Single-flight refresh: if five requests discover an expired token at the same moment they share ONE
 * refresh call. (The server rotates the refresh token on every use, so parallel refreshes would otherwise
 * be mistaken for token theft and sign the user out.)
 */
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  inFlight ??= authApi
    .refresh()
    .then((r) => {
      setAccessToken(r.accessToken);
      return true;
    })
    .catch(() => {
      setAccessToken(null);
      return false;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

setRefreshHandler(refreshSession);
