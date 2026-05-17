import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthPage } from './AuthPage'

const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockToggleTheme = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: vi.fn(),
  }),
}))

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' as const, toggleTheme: mockToggleTheme }),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
}))

function renderAuth() {
  return render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>,
  )
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ error: null })
    mockSignUp.mockResolvedValue({ error: null, needsConfirmation: false })
  })

  it('shows sign-in mode and tagline', () => {
    renderAuth()
    expect(screen.getByRole('heading', { name: /YouPeak/i })).toBeInTheDocument()
    expect(screen.getByText(/Gym Journal|Dnevnik Teretane/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign in|Prijavi se/i })).toBeInTheDocument()
  })

  it('switches to sign up', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.click(screen.getByRole('button', { name: /Don't have an account|Nemaš nalog/i }))
    expect(screen.getByRole('button', { name: /Sign up|Registruj se/i })).toBeInTheDocument()
  })

  it('submits sign-in with pseudo-email from username', async () => {
    const user = userEvent.setup()
    renderAuth()
    await user.type(screen.getByLabelText(/Username|Korisničko ime/i), 'testuser')
    await user.type(screen.getByLabelText(/Password|Lozinka/i), 'secret12')
    await user.click(screen.getByRole('button', { name: /Sign in|Prijavi se/i }))
    expect(mockSignIn).toHaveBeenCalledWith('testuser@youpeak.app', 'secret12')
  })
})
