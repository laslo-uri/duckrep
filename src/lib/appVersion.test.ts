import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './appVersion'

describe('APP_VERSION', () => {
  it('is a non-empty semver-like string from build define', () => {
    expect(typeof APP_VERSION).toBe('string')
    expect(APP_VERSION.length).toBeGreaterThan(0)
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
