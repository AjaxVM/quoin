import { createServer, type Server } from 'node:http'
import type { IPost } from './client.js'

export interface IMockApiServer {
  baseUrl: string
  close: () => Promise<void>
}

/** Deterministic in-repo stand-in for an external API — no real network dependency. */
export function startMockApiServer(posts: IPost[]): Promise<IMockApiServer> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const match = req.url?.match(/^\/users\/(\d+)\/posts$/)
      if (req.method === 'GET' && match) {
        const userId = Number(match[1])
        const userPosts = posts.filter((post) => post.userId === userId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(userPosts))
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            // fetch holds sockets open with keep-alive, and close() waits for them
            // to drain — without this, afterAll stalls until the agent times out.
            server.closeAllConnections()
            server.close(() => done())
          })
      })
    })
  })
}
