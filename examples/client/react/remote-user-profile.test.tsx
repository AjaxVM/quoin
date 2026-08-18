/** @jest-environment ./examples/client/jsdom-fetch-environment.cjs */
import { render, screen, waitFor } from '@testing-library/react'
import { QuoinProvider } from 'quoin/react'
import { startAppServer, type IAppServer } from '../../server.js'
import { startMockApiServer, type IMockApiServer } from '../../api/mock-server.js'
import { createTestScope, POSTS } from '../../fixtures.js'
import { createClientScope } from '../scope.js'
import { RemoteUserProfile } from './remote-user-profile.js'

describe('RemoteUserProfile', () => {
  let postsServer: IMockApiServer
  let appServer: IAppServer

  beforeAll(async () => {
    postsServer = await startMockApiServer(POSTS)
    appServer = await startAppServer(createTestScope(postsServer.baseUrl))
  })

  afterAll(async () => {
    await appServer.close()
    await postsServer.close()
  })

  it('renders a profile pulled entirely over HTTP — backend and posts API alike', async () => {
    const scope = createClientScope(appServer.baseUrl)
    render(
      <QuoinProvider scope={scope}>
        <RemoteUserProfile userId={1} />
      </QuoinProvider>
    )

    expect(screen.getByText('Loading…')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    })
    expect(screen.getByText('Hello world')).toBeTruthy()
    expect(screen.getByText('Difference Engine plans')).toBeTruthy()
  })

  it('shows the failure message when the route 404s', async () => {
    const scope = createClientScope(`${appServer.baseUrl}/wrong-prefix`)
    render(
      <QuoinProvider scope={scope}>
        <RemoteUserProfile userId={1} />
      </QuoinProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })
})
