import { useState, type ReactElement } from 'react'
import { useIterativeResolver } from 'quoin/react'
import { getOrdersByUserIdPaged } from '../resolvers/base/order.js'
import type { IOrder } from '../db/connection.js'

/**
 * Pages are pulled one at a time on demand — the hook only binds the scope, it
 * doesn't decide when or how much of the stream to consume.
 */
export function OrderPages({ userId }: { userId: number }): ReactElement {
  const getPages = useIterativeResolver(getOrdersByUserIdPaged)
  const [generator] = useState(() => getPages({ userId, pageSize: 2 }))
  const [orders, setOrders] = useState<IOrder[]>([])
  const [done, setDone] = useState(false)

  const loadNextPage = async (): Promise<void> => {
    const next = await generator.next()
    if (next.done) {
      setDone(true)
      return
    }
    if (next.value.success) {
      // Narrowed via next.value.success above, but that narrowing doesn't
      // survive into the setOrders callback below — pull the page out first.
      const page = next.value.data
      setOrders((previous) => [...previous, ...page])
    }
  }

  return (
    <div>
      <ul>
        {orders.map((order) => <li key={order.id}>{order.item}</li>)}
      </ul>
      <button onClick={() => { void loadNextPage() }} disabled={done}>
        {done ? 'No more orders' : 'Load more'}
      </button>
    </div>
  )
}
