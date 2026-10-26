/**
 * The access token lives ONLY in this module's memory. It is never written to localStorage,
 * sessionStorage or a cookie, so page scripts cannot find it in storage, and it disappears on reload
 * (the HttpOnly refresh cookie then silently gets a new one).
 */
let accessToken: string | null = null;
export const getAccessToken = (): string | null => accessToken;
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};
