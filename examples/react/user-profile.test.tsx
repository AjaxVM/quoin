/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import { QuoinProvider } from 'quoin/react'
import { createTestScope } from '../fixtures.js'
import { UserProfile } from './user-profile.js'

describe('UserProfile', () => {
  it('renders the resolved user after loading', async () => {
    const scope = createTestScope()
    render(
      <QuoinProvider scope={scope}>
        <UserProfile userId={1} />
      </QuoinProvider>
    )

    expect(screen.getByText('Loading…')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    })
  })

  it('shows the failure message for a missing user', async () => {
    const scope = createTestScope()
    render(
      <QuoinProvider scope={scope}>
        <UserProfile userId={999} />
      </QuoinProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('alert').textContent).toContain('User 999 not found')
  })
})
