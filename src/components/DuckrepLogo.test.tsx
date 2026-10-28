import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuckrepLogo, DuckrepMark } from './DuckrepLogo'

describe('DuckrepLogo', () => {
  it('renders wordmark', () => {
    render(<DuckrepLogo />)
    expect(screen.getByText('Duckrep')).toBeInTheDocument()
  })

  it('draws the mark inline, with the dumbbell', () => {
    const { container } = render(<DuckrepLogo />)
    expect(container.querySelector('svg .dr-logo-bell')).toBeInTheDocument()
    expect(container.querySelector('img[src="/logo.svg"]')).not.toBeInTheDocument()
  })

  it('plays one rep only when asked', () => {
    const { container, rerender } = render(<DuckrepMark size={40} />)
    expect(container.querySelector('.dr-mark-rep')).not.toBeInTheDocument()
    rerender(<DuckrepMark size={40} animateIn />)
    expect(container.querySelector('.dr-mark-rep')).toBeInTheDocument()
  })
})
