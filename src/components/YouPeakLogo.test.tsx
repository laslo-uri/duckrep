import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YouPeakLogo } from './YouPeakLogo'

describe('YouPeakLogo', () => {
  it('renders wordmark by default', () => {
    render(<YouPeakLogo />)
    expect(screen.getByText('YouPeak')).toBeInTheDocument()
  })

  it('hides wordmark when iconOnly', () => {
    render(<YouPeakLogo iconOnly />)
    expect(screen.queryByText('YouPeak')).not.toBeInTheDocument()
  })

  it('renders minimal variant without mask', () => {
    const { container } = render(<YouPeakLogo variant="minimal" iconOnly />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
