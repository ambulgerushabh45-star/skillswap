import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

function TestConsumer() {
  const { user, status, login, logout, register } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user ? user.name : 'no-user'}</span>
      <button onClick={() => login('alex@example.com', 'pass')}>Login</button>
      <button onClick={() => register('Bob', 'bob@example.com', 'pass')}>Register</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes to unauthenticated when session returns user: null', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({ user: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    // Wait for session check to finish
    await screen.findByText('unauthenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('initializes to authenticated when session returns a valid user', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      user: { id: 'u1', name: 'Alex Johnson', email: 'alex@example.com' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('Alex Johnson');
  });

  it('updates state on login success', async () => {
    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce({ user: null }); // initial session

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('unauthenticated');

    apiSpy.mockResolvedValueOnce({
      user: { id: 'u1', name: 'Alex Johnson', email: 'alex@example.com' },
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('Alex Johnson');
  });

  it('clears state on logout', async () => {
    const apiSpy = vi.spyOn(apiModule, 'apiFetch');
    apiSpy.mockResolvedValueOnce({
      user: { id: 'u1', name: 'Alex Johnson', email: 'alex@example.com' },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByText('authenticated');

    apiSpy.mockResolvedValueOnce({ message: 'Logged out' });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });
});

