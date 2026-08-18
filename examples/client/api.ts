export interface IAppApiResponse {
  ok: boolean
  status: number
  body: unknown
}

export interface IAppApiClient {
  get: (path: string) => Promise<IAppApiResponse>
}

/**
 * Talks to the app's own HTTP surface (examples/server.ts) — a thin transport, the
 * same role scope.db plays server-side: it fetches, it doesn't decide what the
 * data means. No result-shape awareness, no validation here — the server is
 * responsible for sending correct data, and it's each resolver's job to map
 * whatever comes back into ok()/fail(), the same way getUserById maps a query row.
 * A genuine transport failure (fetch itself rejecting — DNS, connection refused)
 * still propagates as a throw, uncaught, same as examples/api/client.ts.
 */
export function createAppApiClient(baseUrl: string): IAppApiClient {
  return {
    async get(path: string): Promise<IAppApiResponse> {
      const response = await fetch(`${baseUrl}${path}`)
      return { ok: response.ok, status: response.status, body: await response.json() }
    }
  }
}
