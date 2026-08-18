/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuoinProvider } from 'quoin/react'
import { createTestScope } from '../fixtures.js'
import { OrderPages } from './order-pages.js'

describe('OrderPages', () => {
  it('loads one page of orders per click, then disables the button once exhausted', async () => {
    const scope = createTestScope()
    render(
      <QuoinProvider scope={scope}>
        <OrderPages userId={1} />
      </QuoinProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'No more orders' })).toBeTruthy()
    })
  })
})
