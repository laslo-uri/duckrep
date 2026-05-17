import { describe, expect, it, vi } from 'vitest'
import { toUserFriendlyError } from './authErrors'

const t = vi.fn((key: string) => {
  const map: Record<string, string> = {
    error: 'Something went wrong.',
    authErrorInvalidCredentials: 'Invalid username or password.',
    authErrorUserAlreadyExists: 'Account exists.',
    authErrorWeakPassword: 'Password too weak.',
    authErrorRateLimited: 'Rate limited.',
    authErrorCannotReachSupabase: 'Cannot reach server.',
  }
  return map[key] ?? key
})

describe('toUserFriendlyError', () => {
  it('returns generic error when message is empty', () => {
    expect(toUserFriendlyError(undefined, t)).toBe('Something went wrong.')
    expect(toUserFriendlyError('', t)).toBe('Something went wrong.')
  })

  it('maps invalid login messages', () => {
    expect(toUserFriendlyError('Invalid login credentials', t)).toBe('Invalid username or password.')
    expect(toUserFriendlyError('INVALID_CREDENTIALS', t)).toBe('Invalid username or password.')
  })

  it('maps already registered', () => {
    expect(toUserFriendlyError('User already registered', t)).toBe('Account exists.')
  })

  it('maps weak password', () => {
    expect(toUserFriendlyError('Password should be at least 6 characters', t)).toBe('Password too weak.')
  })

  it('maps rate limit', () => {
    expect(toUserFriendlyError('Too many requests', t)).toBe('Rate limited.')
  })

  it('maps network failures', () => {
    expect(toUserFriendlyError('Failed to fetch', t)).toBe('Cannot reach server.')
    expect(toUserFriendlyError('TypeError: NetworkError', t)).toBe('Cannot reach server.')
  })

  it('returns original message when no rule matches', () => {
    expect(toUserFriendlyError('Custom server message', t)).toBe('Custom server message')
  })
})
