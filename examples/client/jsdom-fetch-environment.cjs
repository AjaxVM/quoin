const JSDOMEnvironment = require('jest-environment-jsdom').default

/**
 * jsdom doesn't implement fetch, and Jest's jsdom environment runs each test file
 * in its own sandboxed global that doesn't inherit Node's real one either — so a
 * fetch call from a jsdom test throws "fetch is not defined" with no code change
 * at fault. This class runs in Jest's own process, not inside the sandbox it
 * builds, so the `fetch` referenced here is still Node's real global; copying it
 * onto the sandboxed one after setup is the standard fix for the gap.
 */
class FetchAwareJSDOMEnvironment extends JSDOMEnvironment {
  async setup() {
    await super.setup()
    this.global.fetch = fetch
    this.global.Headers = Headers
    this.global.Request = Request
    this.global.Response = Response
  }
}

module.exports = FetchAwareJSDOMEnvironment
