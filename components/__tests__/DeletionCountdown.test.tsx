import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeletionCountdown from '../DeletionCountdown';

// Basic test: shows Expirado when past window

describe('DeletionCountdown', () => {
  it('renders Expirado when window elapsed', () => {
    const past = new Date(Date.now() - 120000).toISOString(); // 2 min ago
    render(<DeletionCountdown createdAt={past} windowMs={60000} />);
    expect(screen.getByText(/Expirado/i)).toBeTruthy();
  });

  it('renders mm:ss when still active', () => {
    const now = new Date().toISOString();
    render(<DeletionCountdown createdAt={now} windowMs={60000} />);
    // Should not be expired immediately
    expect(screen.queryByText(/Expirado/i)).toBeNull();
  });
});
