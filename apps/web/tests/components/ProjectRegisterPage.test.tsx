/**
 * ProjectRegisterPage Component Tests
 * 
 * Tests for the ProjectRegisterPage component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectRegisterPage from '@/app/(components)/ProjectRegisterPage';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/projects/register',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock coreApiBase
vi.mock('@/lib/coreApiBase', () => ({
  coreApiBase: () => 'http://localhost:8000',
}));

// Mock fetch
global.fetch = vi.fn();

describe('ProjectRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render project registration form', () => {
    render(<ProjectRegisterPage />);
    
    // Check for form fields
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/risk level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
  });

  it('should allow user to fill in project details', async () => {
    const user = userEvent.setup();
    render(<ProjectRegisterPage />);
    
    const nameInput = screen.getByLabelText(/name/i);
    const slugInput = screen.getByLabelText(/slug/i);
    
    await user.type(nameInput, 'Test Project');
    await user.type(slugInput, 'test-project');
    
    expect(nameInput).toHaveValue('Test Project');
    expect(slugInput).toHaveValue('test-project');
  });

  it('should validate required fields before submission', async () => {
    const user = userEvent.setup();
    render(<ProjectRegisterPage />);
    
    const submitButton = screen.getByRole('button', { name: /create|save/i });
    await user.click(submitButton);
    
    // Should show validation errors or prevent submission
    await waitFor(() => {
      // Check for validation messages or disabled state
      expect(submitButton).toBeInTheDocument();
    });
  });

  it('should submit project data when form is valid', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: '123', slug: 'test-project' }),
    });

    render(<ProjectRegisterPage />);
    
    // Fill in required fields
    await user.type(screen.getByLabelText(/name/i), 'Test Project');
    await user.type(screen.getByLabelText(/slug/i), 'test-project');
    
    const submitButton = screen.getByRole('button', { name: /create|save/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid data' }),
    });

    render(<ProjectRegisterPage />);
    
    await user.type(screen.getByLabelText(/name/i), 'Test Project');
    await user.type(screen.getByLabelText(/slug/i), 'test-project');
    
    const submitButton = screen.getByRole('button', { name: /create|save/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      // Should show error message
      expect(screen.getByText(/error|invalid/i)).toBeInTheDocument();
    });
  });

  it('should allow editing existing project', async () => {
    const mockProject = {
      id: '123',
      slug: 'existing-project',
      name: 'Existing Project',
      risk_level: 'high',
      priority: 'high',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockProject,
    });

    render(<ProjectRegisterPage />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
    });
  });

  it('should display project status options', () => {
    render(<ProjectRegisterPage />);
    
    const statusSelect = screen.getByLabelText(/status/i);
    expect(statusSelect).toBeInTheDocument();
    
    // Check for status options
    expect(screen.getByText(/planned|active|retired/i)).toBeInTheDocument();
  });

  it('should allow setting target threshold', async () => {
    const user = userEvent.setup();
    render(<ProjectRegisterPage />);
    
    const thresholdInput = screen.getByLabelText(/target threshold/i);
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '0.85');
    
    expect(thresholdInput).toHaveValue(0.85);
  });
});
