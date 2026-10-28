import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { DuckrepLogo, DuckrepMark } from './DuckrepLogo'

describe('DuckrepLogo', () => {
  it('renders the two-tone wordmark', () => {
    const { container } = render(<DuckrepLogo />)
    expect(container.querySelector('.dr-wordmark')).toHaveTextContent('Duckrep')
    expect(container.querySelector('.dr-wordmark-rep')).toHaveTextContent(/^rep$/)
  })

  it('uses the brand tile as a decorative image', () => {
    const { container } = render(<DuckrepLogo />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/logo.svg')
    expect(img).toHaveAttribute('alt', '')
  })

  it('plays one rep only when asked', () => {
    const { container, rerender } = render(<DuckrepMark size={40} />)
    expect(container.querySelector('.dr-mark-rep')).not.toBeInTheDocument()
    rerender(<DuckrepMark size={40} animateIn />)
    expect(container.querySelector('.dr-mark-rep')).toBeInTheDocument()
  })
})
