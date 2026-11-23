import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '@/pages/AuthPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

describe('AuthPage component', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogin.mockReset();
    mockRegister.mockReset();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      login: mockLogin,
      register: mockRegister,
    });
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((url) => {
      if (url === '/api/auth/providers') {
        return Promise.resolve({ google: false });
      }
      return Promise.resolve({});
    });
  });

  it('renders login tab by default and switches to signup tab', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Log In to Your Account')).toBeInTheDocument();

    // Click Sign Up tab using userEvent
    await user.click(screen.getByRole('tab', { name: /sign up/i }));
    expect(await screen.findByText('Create a Free Account')).toBeInTheDocument();
  });

  it('populates demo credentials on quick-fill button click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');

    const demoBtn = screen.getByText(/fill demo credentials/i);
    await user.click(demoBtn);

    expect(emailInput).toHaveValue('alex@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('displays server error banner when login fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByText(/fill demo credentials/i));
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('displays rate limit message when 429 occurs', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error('Too many login attempts. Please try again in 45 seconds.'));

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await user.click(screen.getByText(/fill demo credentials/i));
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
    });
  });

  it('hides Google OAuth button when providers.google is false', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((url) => {
      if (url === '/api/auth/providers') return Promise.resolve({ google: false });
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    });
  });

  it('renders enabled Continue with Google button when providers.google is true and navigates on click', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((url) => {
      if (url === '/api/auth/providers') return Promise.resolve({ google: true });
      return Promise.resolve({});
    });

    const assignMock = vi.fn();
    delete window.location;
    window.location = { assign: assignMock };

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    const googleBtn = await screen.findByRole('button', { name: /continue with google/i });
    expect(googleBtn).not.toBeDisabled();

    await user.click(googleBtn);
    expect(assignMock).toHaveBeenCalledWith('/api/auth/google');
  });

  it('displays friendly message for ?error=google_cancelled', async () => {
    render(
      <MemoryRouter initialEntries={['/auth?error=google_cancelled']}>
        <AuthPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Google sign-in was cancelled.')).toBeInTheDocument();
    });
  });

  it('displays friendly message for ?error=account_exists', async () => {
    render(
      <MemoryRouter initialEntries={['/auth?error=account_exists']}>
        <AuthPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('An account with this e-mail already exists. Sign in with your e-mail and password.')
      ).toBeInTheDocument();
    });
  });

  it('displays friendly message for ?error=google_failed', async () => {
    render(
      <MemoryRouter initialEntries={['/auth?error=google_failed']}>
        <AuthPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Google sign-in failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('displays friendly message for ?error=google_unavailable', async () => {
    render(
      <MemoryRouter initialEntries={['/auth?error=google_unavailable']}>
        <AuthPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Google sign-in is currently unavailable.')).toBeInTheDocument();
    });
  });

  it('hides demo credentials quick-fill button in production mode', () => {
    const originalProd = import.meta.env.PROD;
    try {
      import.meta.env.PROD = true;
      render(
        <MemoryRouter>
          <AuthPage />
        </MemoryRouter>
      );
      expect(screen.queryByText(/fill demo credentials/i)).not.toBeInTheDocument();
    } finally {
      import.meta.env.PROD = originalProd;
    }
  });

  it('shows demo credentials quick-fill button in development mode', () => {
    const originalProd = import.meta.env.PROD;
    try {
      import.meta.env.PROD = false;
      render(
        <MemoryRouter>
          <AuthPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/fill demo credentials/i)).toBeInTheDocument();
    } finally {
      import.meta.env.PROD = originalProd;
    }
  });
});
