import { useState, type FormEvent, type ReactElement } from 'react'
import { useMutator } from 'quoin/react'
import { updateUserEmail } from '../resolvers/composite/user.js'

export function UpdateEmailForm({ userId }: { userId: number }): ReactElement {
  const update = useMutator(updateUserEmail)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    setStatus('saving')
    void update({ id: userId }, { email }).then((result) => {
      setStatus(result.success ? 'saved' : 'error')
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value) }}
        />
      </label>
      <button type="submit" disabled={status === 'saving'}>Save</button>
      {status === 'saved' && <p>Saved.</p>}
      {status === 'error' && <p role="alert">Could not save.</p>}
    </form>
  )
}
