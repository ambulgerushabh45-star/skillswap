import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileSetupPage from '@/pages/ProfileSetupPage';
import * as AuthContextModule from '@/context/AuthContext';
import * as apiModule from '@/lib/api';

const mockProfileUser = {
  id: 'u1',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  bio: 'Full stack developer learning UI design.',
  location: 'Koramangala, Bengaluru',
  latitude: 12.9345,
  longitude: 77.6265,
  avatarUrl: '/api/avatars/u1-avatar.webp',
  skillsTeach: [
    {
      id: 'st1',
      proficiency: 'Expert',
      skill: { id: 'sk1', name: 'JavaScript' },
    },
  ],
  skillsLearn: [
    {
      id: 'sl1',
      skill: { id: 'sk2', name: 'UI/UX Design' },
    },
  ],
};

const mockSkillsData = {
  skills: [
    { id: 'sk1', name: 'JavaScript', category: 'Technology' },
    { id: 'sk2', name: 'UI/UX Design', category: 'Design' },
    { id: 'sk3', name: 'Python', category: 'Technology' },
    { id: 'sk4', name: 'Graphic Design', category: 'Design' },
    { id: 'sk5', name: 'Public Speaking', category: 'Communication' },
    { id: 'sk6', name: 'Photography', category: 'Creative' },
  ],
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProfileSetupPage component', () => {
  let mockRefresh;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    mockRefresh = vi.fn().mockResolvedValue(null);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'u1', name: 'Alex Johnson' },
      status: 'authenticated',
      refresh: mockRefresh,
    });
  });

  it('loads profile and available skills, populating fields and skill badges', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Check pre-populated fields
    const bioTextarea = screen.getByPlaceholderText(
      /Share a little bit about yourself/i
    );
    expect(bioTextarea.value).toBe(
      'Full stack developer learning UI design.'
    );

    const locationInput = screen.getByPlaceholderText(
      /e.g. San Francisco, CA or Downtown Boston/i
    );
    expect(locationInput.value).toBe('Koramangala, Bengaluru');

    // Check pre-populated skills
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getAllByText('Expert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('UI/UX Design')).toBeInTheDocument();
  });

  it('adds and removes teach skills and learn skills', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Add teach skill
    const teachInput = screen.getByPlaceholderText(/Enter skill to teach.../i);
    fireEvent.change(teachInput, { target: { value: 'Rust Programming' } });
    fireEvent.keyDown(teachInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Rust Programming')).toBeInTheDocument();

    // Remove teach skill
    const removeJsBtn = screen.getByRole('button', {
      name: /remove javascript/i,
    });
    fireEvent.click(removeJsBtn);
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();

    // Add learn skill
    const learnInput = screen.getByPlaceholderText(/Enter skill to learn.../i);
    fireEvent.change(learnInput, { target: { value: 'Guitar Basics' } });
    fireEvent.keyDown(learnInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByText('Guitar Basics')).toBeInTheDocument();

    // Remove learn skill
    const removeUiBtn = screen.getByRole('button', {
      name: /remove ui\/ux design/i,
    });
    fireEvent.click(removeUiBtn);
    expect(screen.queryByText('UI/UX Design')).not.toBeInTheDocument();
  });

  it('handles quick suggestions click to add skills', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Click "+ Python" quick suggestion under teach section
    const pythonSuggestionBtn = screen.getByRole('button', { name: '+ Python' });
    fireEvent.click(pythonSuggestionBtn);

    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('handles location selection and removal via AddressSearch', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Location is pre-set
    expect(screen.getByText(/Koramangala, Bengaluru/)).toBeInTheDocument();

    // Remove location
    const removeLocationBtn = screen.getByRole('button', {
      name: /remove my location/i,
    });
    fireEvent.click(removeLocationBtn);

    expect(screen.queryByText(/Location set:/)).not.toBeInTheDocument();
  });

  it('validates avatar file size and MIME type on client side', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Test invalid type (.pdf)
    const fileInput = document.querySelector('input[type="file"]');
    const invalidFile = new File(['fake content'], 'test.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      await screen.findByText(/Invalid image type. Please select a JPG, PNG, or WebP image./)
    ).toBeInTheDocument();

    // Test oversized file (> 2 MB)
    const largeFile = new File(['x'.repeat(2.5 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(
      await screen.findByText(/File too large. Maximum size is 2 MB./)
    ).toBeInTheDocument();
  });

  it('RACE CONDITION TEST: uploading avatar updates preview and ensures subsequent Save Profile submits new avatar URL', async () => {
    let savedProfilePayload = null;

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint, options) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        if (options?.method === 'PUT') {
          savedProfilePayload = JSON.parse(options.body);
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ user: mockProfileUser });
      }
      if (endpoint === '/api/user/avatar' && options?.method === 'POST') {
        return Promise.resolve({
          avatarUrl: '/api/avatars/u1-newly-uploaded.webp',
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    // Upload new avatar file
    const fileInput = document.querySelector('input[type="file"]');
    const validFile = new File(['valid png bytes'], 'my-photo.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    // Remove photo button should be visible now that an avatar is set
    expect(
      screen.getByRole('button', { name: /remove photo/i })
    ).toBeInTheDocument();

    // Now user clicks "Save & Find Matches"
    const saveButton = screen.getByRole('button', {
      name: /save & find matches/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(savedProfilePayload).not.toBeNull();
    });

    // VERIFY CRITICAL RACE FIX: The saved payload MUST include the new avatar URL, not the old one
    expect(savedProfilePayload.avatarUrl).toBe(
      '/api/avatars/u1-newly-uploaded.webp'
    );
  });

  it('handles avatar removal and cleans up preview and state', async () => {
    let deleteCalled = false;

    vi.spyOn(apiModule, 'apiFetch').mockImplementation((endpoint, options) => {
      if (endpoint === '/api/skills') {
        return Promise.resolve(mockSkillsData);
      }
      if (endpoint === '/api/user/profile') {
        return Promise.resolve({ user: mockProfileUser });
      }
      if (endpoint === '/api/user/avatar' && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <ProfileSetupPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Set Up Your SkillSwap Profile')
    ).toBeInTheDocument();

    const removePhotoBtn = screen.getByRole('button', {
      name: /remove photo/i,
    });
    fireEvent.click(removePhotoBtn);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(mockRefresh).toHaveBeenCalled();
    });

    // Remove photo button should be hidden once photo is removed
    expect(
      screen.queryByRole('button', { name: /remove photo/i })
    ).not.toBeInTheDocument();
  });
});
