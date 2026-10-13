import { describe, expect, it } from 'vitest'
import { HEALTH_QUOTES, dailyQuote, dayOfYear } from './dailyQuote'

describe('dailyQuote', () => {
  it('keeps one quote for a local day', () => {
    const morning = new Date(2026, 9, 9, 1, 0, 0)
    const night = new Date(2026, 9, 9, 23, 30, 0)
    expect(dailyQuote(morning)).toEqual(dailyQuote(night))
  })

  it('changes on the next local day', () => {
    const today = new Date(2026, 9, 9, 12, 0, 0)
    const tomorrow = new Date(2026, 9, 10, 12, 0, 0)
    expect(dailyQuote(today).text).not.toBe(dailyQuote(tomorrow).text)
  })

  it('gives every day of a leap year its own quote, including February 29', () => {
    expect(HEALTH_QUOTES).toHaveLength(366)
    expect(dayOfYear(new Date(2024, 1, 29))).toBe(60)
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366)

    const seen = new Set()
    for (let month = 0; month < 12; month += 1) {
      const days = new Date(2024, month + 1, 0).getDate()
      for (let day = 1; day <= days; day += 1) {
        const quote = dailyQuote(new Date(2024, month, day, 12))
        expect(HEALTH_QUOTES).toContainEqual(quote)
        seen.add(quote.text)
      }
    }
    expect(seen.size).toBe(366)
    expect(HEALTH_QUOTES).toContainEqual(dailyQuote(new Date(2024, 1, 29)))
  })

  it('does not follow file order through the year', () => {
    const followsFile = Array.from({ length: 366 }, (_, index) => {
      const date = new Date(2024, 0, 1)
      date.setDate(index + 1)
      return dailyQuote(date).text === HEALTH_QUOTES[index].text
    }).every(Boolean)
    expect(followsFile).toBe(false)
  })
})
