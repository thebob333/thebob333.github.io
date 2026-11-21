import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { stores } from '@/lib/storage';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { useContacts } from '@/hooks/useContacts';
import { importedToContacts } from '@/lib/contact-import';

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

  it('bulk contact import saves every contact', () => {
    let api: ReturnType<typeof useContacts>;
    function Harness() {
      api = useContacts();
      return <p data-testid="count">{api.contacts.length}</p>;
    }
    render(<Harness />);
    const people = importedToContacts(Array.from({ length: 20 }, (_, i) => ({ name: `Person ${i}` })));
    act(() => { api.addContacts(people); });
    expect(screen.getByTestId('count').textContent).toBe('20');
    expect(JSON.parse(localStorage.getItem('telos_contacts')!)).toHaveLength(20);
  });
});
