import { describe, expect, it } from 'vitest';
import { autofillDay, dismissBlock, findFreeSlot, undismissBlock } from './plan-autofill';
import type { RepeatableBlock, TimeBlock } from '@/lib/storage';

let n = 0;
const id = () => `b${++n}`;
const DAY = '2026-11-23';
const routine: RepeatableBlock = {
  id: 'r1', title: 'Gym', categoryId: 'workout', startHour: 7, startMinute: 0, durationMinutes: 60, repeatPattern: 'daily', enabled: true,
};

describe('autofillDay', () => {
  it('creates routine and due to-do blocks once, linked to their source', () => {
    const once = autofillDay([], DAY, [routine], [{ todoId: 't1', title: 'Buy shoes' }], {}, id);
    expect(once).toHaveLength(2);
    expect(once.find(b => b.sourceTemplateId === 'r1')).toBeTruthy();
    const twice = autofillDay(once, DAY, [routine], [{ todoId: 't1', title: 'Buy shoes' }], {}, id);
    expect(twice).toBe(once); // no change → same array, no write
  });

  it('moving or renaming a routine block never creates a duplicate', () => {
    const blocks = autofillDay([], DAY, [routine], [], {}, id);
    const moved = blocks.map(b => ({ ...b, title: 'Leg day', startHour: 18 }));
    expect(autofillDay(moved, DAY, [routine], [], {}, id)).toBe(moved);
  });

  it('a removed block stays removed for that day', () => {
    const blocks = autofillDay([], DAY, [routine], [], {}, id);
    const dismissed = dismissBlock({}, blocks[0], DAY);
    expect(autofillDay([], DAY, [routine], [], dismissed, id)).toEqual([]);
    // …but undo brings it back
    expect(autofillDay([], DAY, [routine], [], undismissBlock(dismissed, blocks[0]), id)).toHaveLength(1);
  });

  it('adopts older routine blocks (no source id) instead of duplicating them', () => {
    const legacy: TimeBlock = { id: 'old', dayName: DAY, categoryId: 'workout', title: 'Gym', startHour: 7, startMinute: 0, durationMinutes: 60 };
    const out = autofillDay([legacy], DAY, [routine], [], {}, id);
    expect(out).toHaveLength(1);
    expect(out[0].sourceTemplateId).toBe('r1');
  });

  it('places due to-dos in free slots instead of stacking them at 9:00', () => {
    const busy: TimeBlock = { id: 'm', dayName: DAY, categoryId: 'work', title: 'Meeting', startHour: 9, startMinute: 0, durationMinutes: 60 };
    const out = autofillDay([busy], DAY, [], [{ todoId: 'a', title: 'A' }, { todoId: 'b', title: 'B', effort: 'HIGH' }], {}, id);
    const a = out.find(b => b.todoId === 'a')!;
    const b = out.find(b => b.todoId === 'b')!;
    expect([a.startHour, a.startMinute]).toEqual([10, 0]);
    expect([b.startHour, b.startMinute]).toEqual([10, 30]);
  });

  it('keeps blocks you placed for practices', () => {
    const habitBlock: TimeBlock = { id: 'h', dayName: DAY, categoryId: 'goals', title: 'x', startHour: 6, startMinute: 0, durationMinutes: 15, habitId: 'h1' };
    const blocks = [habitBlock];
    expect(autofillDay(blocks, DAY, [], [], {}, id)).toBe(blocks);
  });
});

describe('findFreeSlot', () => {
  it('finds a gap between blocks and never runs past the end of the day', () => {
    expect(findFreeSlot([{ startHour: 9, startMinute: 0, durationMinutes: 30 }, { startHour: 10, startMinute: 0, durationMinutes: 30 }], 30)).toBe(9 * 60 + 30);
    // A day booked solid from 9 AM → the next free hour is 11 PM (the planner runs until 3 AM).
    expect(findFreeSlot([{ startHour: 9, startMinute: 0, durationMinutes: 14 * 60 }], 60)).toBe(23 * 60);
    // Nothing free before 3 AM → it goes at the very end.
    expect(findFreeSlot([{ startHour: 9, startMinute: 0, durationMinutes: 18 * 60 }], 60)).toBe(26 * 60);
  });
});

describe('dismissBlock', () => {
  it('prunes entries older than ~2 months', () => {
    const block: TimeBlock = { id: 'x', dayName: DAY, categoryId: 'goals', title: 'x', startHour: 9, startMinute: 0, durationMinutes: 30, todoId: 't' };
    const out = dismissBlock({ '2026-01-01': ['todo:old'] }, block, DAY);
    expect(out).toEqual({ [DAY]: ['todo:t'] });
  });
});
