// Client for the Identity Admin API (external system). The API key never leaves the server.
export interface AdminApi {
  health(): Promise<boolean>;
}

export function createAdminApi(baseUrl: string, apiKey: string): AdminApi {
  const call = (path: string, init: RequestInit = {}) =>
    fetch(new URL(path, baseUrl), {
      ...init,
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(5000),
    });

  return {
    async health() {
      const res = await call("/health");
      return res.ok;
    },
  };
}
