import { ok, fail } from 'quoin'
import type { TAppResult } from '../quoin.js'

export interface IPost {
  id: number
  userId: number
  title: string
  body: string
}

export interface IPostsApiClient {
  getPostsByUserId: (userId: number) => Promise<TAppResult<IPost[]>>
  /** A raw GET, unvalidated — the building block `cachedApiFetch` composes over. */
  getByPath: (path: string) => Promise<TAppResult<unknown>>
}

/**
 * This adapter returns results, so resolvers over it are pure relays. An HTTP 500
 * is the API saying "not right now" — expected traffic. Contrast db/query.ts, which
 * throws: a row not matching its declared columns means the code and the schema
 * disagree, which is a bug.
 *
 * REVIEW: validation is hand-rolled to keep the examples dependency-free. A real app
 * would use zod/valibot.
 */
function toPost(value: unknown, index: number): IPost | string {
  const at = `posts[${index}]`
  if (typeof value !== 'object' || value === null) {
    return `${at} is not an object`
  }
  const { id, userId, title, body } = value as Record<string, unknown>
  if (typeof id !== 'number' || typeof userId !== 'number') {
    return `${at} is missing a numeric id/userId`
  }
  if (typeof title !== 'string' || typeof body !== 'string') {
    return `${at} is missing a string title/body`
  }
  return { id, userId, title, body }
}

export function createPostsApiClient(baseUrl: string): IPostsApiClient {
  return {
    async getPostsByUserId(userId: number): Promise<TAppResult<IPost[]>> {
      const response = await fetch(`${baseUrl}/users/${userId}/posts`)
      if (!response.ok) {
        return fail({
          code: 'POSTS_API_UNAVAILABLE',
          message: `Posts API request failed with status ${response.status}`,
          // 5xx is worth another go; a 404 means the caller asked for the wrong thing.
          retryable: response.status >= 500
        })
      }

      const payload: unknown = await response.json()
      if (!Array.isArray(payload)) {
        return fail({
          code: 'POSTS_API_MALFORMED',
          message: 'Posts API did not return an array'
        })
      }

      const posts: IPost[] = []
      for (const [index, entry] of payload.entries()) {
        const post = toPost(entry, index)
        if (typeof post === 'string') {
          return fail({ code: 'POSTS_API_MALFORMED', message: post })
        }
        posts.push(post)
      }
      return ok(posts)
    },

    async getByPath(path: string): Promise<TAppResult<unknown>> {
      const response = await fetch(`${baseUrl}${path}`)
      if (!response.ok) {
        return fail({
          code: 'API_UNAVAILABLE',
          message: `Request to ${path} failed with status ${response.status}`,
          retryable: response.status >= 500
        })
      }
      return ok(await response.json())
    }
  }
}
