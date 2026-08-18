/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuoinProvider } from 'quoin/react'
import { createTestScope } from '../fixtures.js'
import { UpdateEmailForm } from './update-email-form.js'

describe('UpdateEmailForm', () => {
  it('saves the new email and shows confirmation', async () => {
    const scope = createTestScope()
    render(
      <QuoinProvider scope={scope}>
        <UpdateEmailForm userId={1} />
      </QuoinProvider>
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Saved.')).toBeTruthy()
    })
  })

  it('shows an error for a nonexistent user', async () => {
    const scope = createTestScope()
    render(
      <QuoinProvider scope={scope}>
        <UpdateEmailForm userId={999} />
      </QuoinProvider>
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })
})
