import { createServer, type Server } from 'node:http'
import type { IAppScope } from './scope.js'
import { getUserProfile } from './resolvers/composite/user.js'
import { getOrdersByUserId } from './resolvers/base/order.js'

export interface IAppServer {
  baseUrl: string
  close: () => Promise<void>
}

const ROUTE = /^\/users\/(\d+)\/(profile|orders)$/

/**
 * The app's own HTTP surface — what examples/client/ actually talks to. Each route
 * is a thin relay onto the same resolvers the DB-backed examples call directly.
 * Ordinary REST on the wire, not Quoin's own result shape: `200` + the plain data
 * on success, a non-2xx + the error on failure. The client side maps that back
 * into a result itself — same job a resolver does over any other source.
 */
export function startAppServer(scope: IAppScope): Promise<IAppServer> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const match = req.url?.match(ROUTE)
      if (req.method !== 'GET' || !match) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 'ROUTE_NOT_FOUND', message: 'not found' }))
        return
      }

      const id = Number(match[1])
      const call = match[2] === 'profile'
        ? getUserProfile({ id }, scope)
        : getOrdersByUserId({ userId: id }, scope)

      void call.then((result) => {
        res.writeHead(result.success ? 200 : 502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result.success ? result.data : result.error))
      })
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
