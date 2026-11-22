import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { stores } from '@/lib/storage';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';

function Panel() {
  const { focusIds } = useWeeklyFocus();
  return <p data-testid="panel">{focusIds.join(',')}</p>;
}

function Star({ id }: { id: string }) {
  const { toggle } = useWeeklyFocus();
  return <button onClick={() => toggle(id)}>star {id}</button>;
}

describe('shared stores in React', () => {
  it('two components see the same weekly focus (stars no longer overwrite each other)', () => {
    render(<><Panel /><Star id="a" /><Star id="b" /><Star id="c" /><Star id="d" /></>);
    act(() => screen.getByText('star a').click());
    act(() => screen.getByText('star b').click());
    expect(screen.getByTestId('panel').textContent).toBe('a,b');
    act(() => screen.getByText('star c').click());
    act(() => screen.getByText('star d').click()); // over the limit of 3
    expect(screen.getByTestId('panel').textContent).toBe('a,b,c');
    expect(stores.WEEKLY_FOCUS.get()).toEqual(['a', 'b', 'c']);
  });
});
