import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';
import { KEYS } from '@/lib/storage';
import { listSnapshots } from '@/lib/snapshots';

function Boom(): JSX.Element {
  throw new Error('kaboom');
}

describe('AppErrorBoundary', () => {
  it('shows the recovery screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Save backup/)).toBeInTheDocument();
  });

  it('lets you reset a broken section (after saving a safety copy)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(KEYS.GOALS, '{broken');
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText(/unreadable/)).toBeInTheDocument();
    const reset = screen.getByRole('button', { name: 'Reset' });
    act(() => reset.click());
    await act(async () => { screen.getByRole('button', { name: 'Tap to confirm' }).click(); });
    expect(localStorage.getItem(KEYS.GOALS)).toBeNull();
    expect((await listSnapshots()).some(s => s.reason === 'pre-reset')).toBe(true);
  });
});
