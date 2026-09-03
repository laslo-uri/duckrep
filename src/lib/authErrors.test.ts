import { describe, expect, it, vi } from 'vitest'
import { toUserFriendlyError, toQueryErrorMessage } from './authErrors'

const t = vi.fn((key: string) => {
  const map: Record<string, string> = {
    error: 'Something went wrong.',
    authErrorCannotReachServer: 'Cannot reach local database.',
    notFound: 'Not found.',
  }
  return map[key] ?? key
})

describe('toUserFriendlyError', () => {
  it('returns generic error when message is empty', () => {
    expect(toUserFriendlyError(undefined, t)).toBe('Something went wrong.')
    expect(toUserFriendlyError('', t)).toBe('Something went wrong.')
  })

  it('maps network and database failures', () => {
    expect(toUserFriendlyError('Failed to fetch', t)).toBe('Cannot reach local database.')
    expect(toUserFriendlyError('TypeError: NetworkError', t)).toBe('Cannot reach local database.')
    expect(toUserFriendlyError('SQLite exec failed', t)).toBe('Cannot reach local database.')
  })

  it('returns original message when no rule matches', () => {
    expect(toUserFriendlyError('Custom server message', t)).toBe('Custom server message')
  })
})

describe('toQueryErrorMessage', () => {
  it('maps not found', () => {
    expect(toQueryErrorMessage('JSON object requested, multiple (or no) rows returned', t)).toBe('Not found.')
  })

  it('maps database reachability', () => {
    expect(toQueryErrorMessage('database is not ready', t)).toBe('Cannot reach local database.')
  })
})
