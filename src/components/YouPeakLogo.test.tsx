import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YouPeakLogo } from './YouPeakLogo'

describe('YouPeakLogo', () => {
  it('renders wordmark', () => {
    render(<YouPeakLogo />)
    expect(screen.getByText('YouPeak')).toBeInTheDocument()
  })

  it('does not render coin icon', () => {
    const { container } = render(<YouPeakLogo />)
    expect(container.querySelector('.brand-coin')).not.toBeInTheDocument()
    expect(container.querySelector('img[src="/logo.svg"]')).not.toBeInTheDocument()
  })
})
