import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import Layout from '@/components/Layout';
import AuthPage from '@/pages/AuthPage';
import ProfileSetupPage from '@/pages/ProfileSetupPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Part 3: Privacy, Terms, and Account Deletion Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Privacy and Terms Pages', () => {
    it('renders Privacy Policy page with disclaimer, data collection disclosures, and contact email', () => {
      render(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Developer Notice & Legal Disclaimer/i)).toBeInTheDocument();
      expect(screen.getByText(/Privacy Policy for SkillSwap/i)).toBeInTheDocument();
      expect(screen.getByText(/Approximate coordinates from address searches/i)).toBeInTheDocument();
      expect(screen.getByText(/one necessary session cookie/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy@skillswap.local/i)).toBeInTheDocument();
    });

    it('renders Terms of Service page with disclaimer, safety advice for meeting strangers, and acceptable use', () => {
      render(
        <MemoryRouter>
          <TermsPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Developer Notice & Legal Disclaimer/i)).toBeInTheDocument();
      expect(screen.getByText(/Terms of Service for SkillSwap/i)).toBeInTheDocument();
      expect(screen.getByText(/Safety Advice for Meeting Strangers/i)).toBeInTheDocument();
      expect(screen.getByText(/Meet in Public/i)).toBeInTheDocument();
      expect(screen.getByText(/Acceptable Use Policy/i)).toBeInTheDocument();
    });

    it('Layout footer contains links to Privacy Policy and Terms of Service', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        status: 'unauthenticated',
        user: null,
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
      const termsLink = screen.getByRole('link', { name: /Terms of Service/i });

      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', '/privacy');
      expect(termsLink).toBeInTheDocument();
      expect(termsLink).toHaveAttribute('href', '/terms');
    });

    it('AuthPage sign-up form links to Terms and Privacy Policy', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        status: 'unauthenticated',
        login: vi.fn(),
        register: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/auth?tab=signup']}>
          <AuthPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Create a Free Account/i })).toBeInTheDocument();
      });

      const termsLink = screen.getByRole('link', { name: /^Terms$/i });
      const privacyLink = screen.getByRole('link', { name: /^Privacy Policy$/i });

      expect(termsLink).toBeInTheDocument();
      expect(termsLink).toHaveAttribute('href', '/terms');
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', '/privacy');
    });
  });

  describe('Account Deletion Danger Zone in ProfileSetupPage', () => {
    const mockUser = {
      id: 'u123',
      name: 'Alex Johnson',
      email: 'alex@example.com',
      authMethod: 'password',
      emailNotifications: true,
      skillsTeach: [],
      skillsLearn: [],
    };

    it('renders danger zone section and requires password and DELETE confirmation for password accounts', async () => {
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockUser,
        refresh: vi.fn().mockResolvedValue(mockUser),
        logout: mockLogout,
      });

      vi.spyOn(apiModule, 'apiFetch').mockImplementation((url, opts) => {
        if (url === '/api/user/profile' && (!opts || opts.method === 'GET')) {
          return Promise.resolve({ user: mockUser });
        }
        if (url === '/api/skills') {
          return Promise.resolve({ skills: [] });
        }
        if (url === '/api/user/account' && opts?.method === 'DELETE') {
          return Promise.resolve({ message: 'Account successfully deleted' });
        }
        return Promise.resolve({});
      });

      render(
        <MemoryRouter>
          <ProfileSetupPage />
        </MemoryRouter>
      );

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(/Set Up Your SkillSwap Profile/i)).toBeInTheDocument();
      });

      // Find Danger Zone button
      const deleteButtons = screen.getAllByRole('button', { name: /Delete my account/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      fireEvent.click(deleteButtons[0]);

      // Modal appears
      expect(screen.getByRole('heading', { name: /Delete Account Permanently/i })).toBeInTheDocument();
      expect(screen.getByText(/Confirm your password/i)).toBeInTheDocument();

      const permanentlyDeleteBtn = screen.getByRole('button', { name: /Permanently Delete/i });
      // Initially disabled because confirm text and password are empty
      expect(permanentlyDeleteBtn).toBeDisabled();

      // Enter password
      const passwordInput = screen.getByPlaceholderText('••••••••');
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      expect(permanentlyDeleteBtn).toBeDisabled();

      // Type DELETE
      const confirmInput = screen.getByPlaceholderText('DELETE');
      fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

      // Button is now enabled
      expect(permanentlyDeleteBtn).not.toBeDisabled();

      // Click delete
      fireEvent.click(permanentlyDeleteBtn);

      await waitFor(() => {
        expect(apiModule.apiFetch).toHaveBeenCalledWith(
          '/api/user/account',
          expect.objectContaining({
            method: 'DELETE',
            body: JSON.stringify({ confirm: 'DELETE', password: 'password123' }),
          })
        );
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(
          '/',
          expect.objectContaining({
            state: { notice: 'Your account has been permanently deleted.' },
            replace: true,
          })
        );
      });
    });

    it('hides password input for Google accounts during deletion', async () => {
      const googleUser = {
        ...mockUser,
        authMethod: 'google',
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: googleUser,
        refresh: vi.fn().mockResolvedValue(googleUser),
        logout: vi.fn(),
      });

      vi.spyOn(apiModule, 'apiFetch').mockImplementation((url) => {
        if (url === '/api/user/profile') return Promise.resolve({ user: googleUser });
        if (url === '/api/skills') return Promise.resolve({ skills: [] });
        return Promise.resolve({});
      });

      render(
        <MemoryRouter>
          <ProfileSetupPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Set Up Your SkillSwap Profile/i)).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete my account/i });
      fireEvent.click(deleteButtons[0]);

      // Password input should NOT be in the document
      expect(screen.queryByText(/Confirm your password/i)).not.toBeInTheDocument();

      // Type DELETE enables button directly
      const permanentlyDeleteBtn = screen.getByRole('button', { name: /Permanently Delete/i });
      expect(permanentlyDeleteBtn).toBeDisabled();

      const confirmInput = screen.getByPlaceholderText('DELETE');
      fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
      expect(permanentlyDeleteBtn).not.toBeDisabled();
    });

    it('displays server errors if account deletion fails', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockUser,
        refresh: vi.fn().mockResolvedValue(mockUser),
        logout: vi.fn(),
      });

      vi.spyOn(apiModule, 'apiFetch').mockImplementation((url, opts) => {
        if (url === '/api/user/profile') return Promise.resolve({ user: mockUser });
        if (url === '/api/skills') return Promise.resolve({ skills: [] });
        if (url === '/api/user/account') {
          return Promise.reject(new Error('Invalid password'));
        }
        return Promise.resolve({});
      });

      render(
        <MemoryRouter>
          <ProfileSetupPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Set Up Your SkillSwap Profile/i)).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /Delete my account/i });
      fireEvent.click(deleteButtons[0]);

      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'wrongpass' },
      });
      fireEvent.change(screen.getByPlaceholderText('DELETE'), {
        target: { value: 'DELETE' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Permanently Delete/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid password')).toBeInTheDocument();
      });
    });
  });
});
