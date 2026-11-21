import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TimeBlock, BlockCategory, DEFAULT_CATEGORIES, stores, generateId, Contact } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { autofillDay, dismissBlock, undismissBlock } from '@/lib/plan-autofill';
import { QuickLogSheet } from '@/components/people/QuickLogSheet';
import { todayKey } from '@/lib/dates';
import { shouldShowOnDay } from '@/lib/routines';
import { Check, Repeat, User } from 'lucide-react';
import { toast } from 'sonner';
import { BlockSheet, type BacklogTodo } from '@/components/plan/BlockSheet';
import { CategoriesSheet } from '@/components/plan/CategoriesSheet';
import { cn } from '@/lib/utils';

export type { BacklogTodo };

// 5 AM to 11 PM. Phones get a taller timeline and 15-minute snapping so blocks
// are big enough to tap and easy to place with a thumb.
const IS_PHONE = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px)').matches;
const LONG_PRESS_MS = 300;
const MOVE_CANCEL_PX = 8;
const START_HOUR = 5;
const END_HOUR = 23; // exclusive
const NO_TODOS: BacklogTodo[] = [];
const NO_CONTACTS: Contact[] = [];
const TB = stores.TIME_BLOCKS;
const CATS = stores.BLOCK_CATEGORIES;
const PIXEL_PER_MINUTE = IS_PHONE ? 1.5 : 1;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const TOTAL_HEIGHT = TOTAL_MINUTES * PIXEL_PER_MINUTE;
const SNAP_MINUTES = IS_PHONE ? 15 : 5;
const LABEL_WIDTH = 56; // px for time labels column
const MIN_DURATION = IS_PHONE ? 15 : 5;

/** Room above the first hour so its label isn't clipped. */
const TOP_PAD = 8;

function minutesToTop(minutes: number): number {
  return (minutes - START_HOUR * 60) * PIXEL_PER_MINUTE + TOP_PAD;
}

function topToMinutes(top: number): number {
  return Math.round((top - TOP_PAD) / PIXEL_PER_MINUTE) + START_HOUR * 60;
}

function snapMinutes(m: number): number {
  return Math.round(m / SNAP_MINUTES) * SNAP_MINUTES;
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${display} ${period}` : `${display}:${String(m).padStart(2, '0')} ${period}`;
}

function blockStartMinutes(b: TimeBlock): number {
  return b.startHour * 60 + b.startMinute;
}

function blockEndMinutes(b: TimeBlock): number {
  return blockStartMinutes(b) + b.durationMinutes;
}

// Column-packing algorithm for overlapping blocks
interface LayoutInfo {
  column: number;
  totalColumns: number;
}

function computeColumns(blocks: TimeBlock[]): Map<string, LayoutInfo> {
  const sorted = [...blocks].sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b));
  const result = new Map<string, LayoutInfo>();
  
  // Assign columns greedily
  const columns: { endMinute: number; blockId: string }[][] = [];
  
  for (const block of sorted) {
    const start = blockStartMinutes(block);
    const end = blockEndMinutes(block);
    
    // Find first column where this block fits (no overlap)
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      if (lastInCol.endMinute <= start) {
        columns[col].push({ endMinute: end, blockId: block.id });
        result.set(block.id, { column: col, totalColumns: 0 }); // totalColumns set later
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ endMinute: end, blockId: block.id }]);
      result.set(block.id, { column: columns.length - 1, totalColumns: 0 });
    }
  }

  // For each block, find how many columns overlap with it
  for (const block of sorted) {
    const start = blockStartMinutes(block);
    const end = blockEndMinutes(block);
    
    // Find all blocks that overlap with this one
    const overlapping = sorted.filter(other => {
      const oStart = blockStartMinutes(other);
      const oEnd = blockEndMinutes(other);
      return oStart < end && oEnd > start;
    });
    
    // The max column index among overlapping blocks + 1
    let maxCol = 0;
    for (const o of overlapping) {
      const info = result.get(o.id);
      if (info) maxCol = Math.max(maxCol, info.column);
    }
    const totalCols = maxCol + 1;
    
    // Update all overlapping blocks to share the same totalColumns
    for (const o of overlapping) {
      const info = result.get(o.id);
      if (info) {
        info.totalColumns = Math.max(info.totalColumns, totalCols);
      }
    }
  }

  // Ensure minimum of 1 column
  for (const [, info] of result) {
    if (info.totalColumns === 0) info.totalColumns = 1;
  }

  return result;
}


interface DailyTimeBlocksProps {
  /** Local date key (YYYY-MM-DD) being planned. */
  dayName: string;
  onToggleTodo?: (todoId: string) => void;
  backlogTodos?: BacklogTodo[];
  deadlineTodos?: BacklogTodo[];
  contacts?: Contact[];
  todoStates?: Record<string, boolean>;
}

export default function DailyTimeBlocks({ dayName, onToggleTodo, backlogTodos = NO_TODOS, deadlineTodos = NO_TODOS, contacts = NO_CONTACTS, todoStates }: DailyTimeBlocksProps) {
  const blocks = useStore(TB);
  const categories = useStore(CATS);
  const repeatableBlocks = useStore(stores.REPEATABLE_BLOCKS);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  
  // Drag state
  const [dragging, setDragging] = useState<{ blockId: string; offsetMin: number } | null>(null);
  const [dragPreviewMin, setDragPreviewMin] = useState<number | null>(null);
  
  // Resize state
  const [resizeDrag, setResizeDrag] = useState<{ blockId: string; startY: number; startDuration: number } | null>(null);
  const [logContact, setLogContact] = useState<Contact | null>(null);
  // Live preview while resizing; saved once on release instead of on every pointer move.
  const [resizePreview, setResizePreview] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const dayBlocks = useMemo(() => 
    blocks.filter(b => b.dayName === dayName).sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b)),
    [blocks, dayName]
  );

  // Auto-fill from routines and due to-dos. One atomic update from the latest
  // blocks; no write when nothing changes. Removed blocks stay removed.
  const dismissed = useStore(stores.PLAN_DISMISSED);
  const deadlineKey = deadlineTodos.map(t => t.todoId).join('|');
  useEffect(() => {
    const routines = repeatableBlocks.filter(t => shouldShowOnDay(t, dayName));
    TB.update(prev => autofillDay(prev, dayName, routines, deadlineTodos, stores.PLAN_DISMISSED.get(), generateId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the day, routines, due to-dos or dismissals change
  }, [dayName, repeatableBlocks, deadlineKey, dismissed]);

  const columnLayout = useMemo(() => computeColumns(dayBlocks), [dayBlocks]);

  const addBlock = useCallback((minuteOfDay: number) => {
    const snapped = snapMinutes(minuteOfDay);
    const newBlock: TimeBlock = {
      id: generateId(),
      dayName,
      categoryId: categories[0]?.id || 'workout',
      title: '',
      startHour: Math.floor(snapped / 60),
      startMinute: snapped % 60,
      durationMinutes: 30,
    };
    TB.update(prev => [...prev, newBlock]);
    setEditingBlock(newBlock.id);
  }, [dayName, categories]);

  const updateBlock = useCallback((blockId: string, updates: Partial<TimeBlock>) => {
    TB.update(prev => prev.map(b => (b.id === blockId ? { ...b, ...updates } : b)));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    const removed = TB.get().find(b => b.id === blockId);
    if (!removed) return;
    TB.update(prev => prev.filter(b => b.id !== blockId));
    // Auto-created blocks are remembered so they don't come straight back.
    stores.PLAN_DISMISSED.update(d => dismissBlock(d, removed, todayKey()));
    setEditingBlock(null);
    toast.success('Block removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          stores.PLAN_DISMISSED.update(d => undismissBlock(d, removed));
          TB.update(prev => (prev.some(b => b.id === removed.id) ? prev : [...prev, removed]));
        },
      },
    });
  }, []);

  const getCat = (catId: string) => categories.find(c => c.id === catId) || categories[0] || DEFAULT_CATEGORIES[0];

  // ─── Pointer handlers for drag ───
  // Mouse: drag immediately. Touch: press and hold (~0.3s) to pick a block up,
  // so a normal swipe over the planner scrolls instead of moving blocks.
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  draggingRef.current = !!dragging || !!resizeDrag;

  const cancelLongPress = useCallback(() => {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }, []);

  const startDrag = useCallback((clientY: number, blockId: string, target: HTMLElement, pointerId: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const block = TB.get().find(b => b.id === blockId);
    if (!rect || !block) return;
    const blockTopMin = blockStartMinutes(block);
    const pointerMin = topToMinutes(clientY - rect.top + (containerRef.current?.scrollTop || 0));
    setDragging({ blockId, offsetMin: pointerMin - blockTopMin });
    setDragPreviewMin(blockTopMin);
    try { target.setPointerCapture?.(pointerId); } catch { /* pointer already released */ }
    navigator.vibrate?.(10);
  }, []);

  const handleBlockPointerDown = useCallback((e: React.PointerEvent, blockId: string) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-resize-handle]') || el.closest('input') || el.closest('button')) return;
    if (e.pointerType === 'mouse') {
      startDrag(e.clientY, blockId, el, e.pointerId);
      e.preventDefault();
      return;
    }
    cancelLongPress();
    const { clientX, clientY, pointerId } = e;
    const target = e.currentTarget as HTMLElement;
    longPress.current = {
      x: clientX,
      y: clientY,
      timer: setTimeout(() => {
        longPress.current = null;
        startDrag(clientY, blockId, target, pointerId);
      }, LONG_PRESS_MS),
    };
  }, [startDrag, cancelLongPress]);

  // While dragging on a touchscreen, stop the page from scrolling under your finger.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => { if (draggingRef.current) ev.preventDefault(); };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Finger moved before the long-press fired → it's a scroll, not a drag.
    if (longPress.current && Math.hypot(e.clientX - longPress.current.x, e.clientY - longPress.current.y) > MOVE_CANCEL_PX) {
      cancelLongPress();
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const pointerMin = topToMinutes(e.clientY - rect.top + (containerRef.current?.scrollTop || 0));

    if (dragging) {
      const rawMin = pointerMin - dragging.offsetMin;
      const block = blocks.find(b => b.id === dragging.blockId);
      if (!block) return;
      const snapped = snapMinutes(Math.max(START_HOUR * 60, Math.min(rawMin, END_HOUR * 60 - block.durationMinutes)));
      setDragPreviewMin(snapped);
    }
    
    if (resizeDrag) {
      const block = blocks.find(b => b.id === resizeDrag.blockId);
      if (!block) return;
      const startMin = blockStartMinutes(block);
      const deltaY = e.clientY - resizeDrag.startY;
      const deltaMin = deltaY / PIXEL_PER_MINUTE;
      const newDuration = snapMinutes(Math.max(MIN_DURATION, resizeDrag.startDuration + deltaMin));
      const maxDuration = END_HOUR * 60 - startMin;
      const clampedDuration = Math.min(newDuration, maxDuration);
      setResizePreview(clampedDuration);
    }
  }, [dragging, resizeDrag, blocks, cancelLongPress]);

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
    if (dragging && dragPreviewMin !== null) {
      const snapped = snapMinutes(dragPreviewMin);
      updateBlock(dragging.blockId, {
        startHour: Math.floor(snapped / 60),
        startMinute: snapped % 60,
      });
    }
    if (resizeDrag && resizePreview !== null) {
      updateBlock(resizeDrag.blockId, { durationMinutes: resizePreview });
    }
    setDragging(null);
    setDragPreviewMin(null);
    setResizeDrag(null);
    setResizePreview(null);
  }, [dragging, dragPreviewMin, resizeDrag, resizePreview, updateBlock, cancelLongPress]);

  const handlePointerCancel = useCallback(() => {
    cancelLongPress();
    setDragging(null);
    setDragPreviewMin(null);
    setResizeDrag(null);
    setResizePreview(null);
  }, [cancelLongPress]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent, blockId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setResizeDrag({ blockId, startY: e.clientY, startDuration: block.durationMinutes });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [blocks]);

  // Click on empty timeline to add block
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragging || resizeDrag) return;
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
    const minuteOfDay = topToMinutes(y);
    if (minuteOfDay >= START_HOUR * 60 && minuteOfDay < END_HOUR * 60) {
      addBlock(minuteOfDay);
    }
  }, [addBlock, dragging, resizeDrag]);

  // Generate hour lines
  const hourLines = useMemo(() => {
    const lines = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      lines.push({ hour: h, top: minutesToTop(h * 60) });
    }
    return lines;
  }, []);


  // ─── "Now" line and starting scroll position ───
  const isToday = dayName === todayKey();
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Today: an hour before now. Other days: the first block, or 7 AM.
    const first = TB.get().filter(b => b.dayName === dayName).map(blockStartMinutes).sort((a, b) => a - b)[0];
    const d = new Date();
    const target = isToday ? d.getHours() * 60 + d.getMinutes() - 60 : (first ?? 7 * 60) - 30;
    el.scrollTop = Math.max(0, minutesToTop(target));
  }, [dayName, isToday]);

  const editing = editingBlock ? dayBlocks.find(b => b.id === editingBlock) ?? null : null;
  const isDone = (b: TimeBlock) => (b.todoId && todoStates ? (todoStates[b.todoId] ?? false) : (b.done ?? false));
  const toggleDone = (b: TimeBlock) => {
    updateBlock(b.id, { done: !isDone(b) });
    if (b.todoId) onToggleTodo?.(b.todoId);
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none overflow-y-auto"
        style={{ cursor: dragging ? 'grabbing' : 'default' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleTimelineClick}
      >
        {dayBlocks.length === 0 && (
          <div className="pointer-events-none sticky top-3 z-20 flex h-0 justify-center">
            <span className="h-fit rounded-full bg-foreground/80 px-3.5 py-1.5 text-footnote font-medium text-background shadow-lg">
              {IS_PHONE ? 'Tap any time to add a block' : 'Click any time to add a block'}
            </span>
          </div>
        )}
        <div className="relative" style={{ height: TOTAL_HEIGHT + TOP_PAD * 2 }}>
          {/* Hour lines & labels */}
          {hourLines.map(({ hour, top }) => (
            <div key={hour} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-start">
                <span className="-mt-2 shrink-0 pr-2 text-right text-[11px] font-medium tabular-nums text-muted-foreground" style={{ width: LABEL_WIDTH }}>
                  {formatTime(hour * 60)}
                </span>
                <div className="flex-1 border-t border-border/70" />
              </div>
            </div>
          ))}

          {/* Now */}
          {isToday && nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60 && (
            <div className="pointer-events-none absolute right-0 z-20 flex items-center" style={{ top: minutesToTop(nowMin) - 5, left: LABEL_WIDTH - 5 }}>
              <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span className="h-[2px] flex-1 bg-destructive" />
            </div>
          )}

          {/* Time Blocks */}
          {dayBlocks.map((block) => {
            const cat = getCat(block.categoryId);
            const layout = columnLayout.get(block.id) || { column: 0, totalColumns: 1 };
            const isDragging = dragging?.blockId === block.id;
            const startMin = isDragging && dragPreviewMin !== null ? dragPreviewMin : blockStartMinutes(block);
            const top = minutesToTop(startMin);
            const duration = resizeDrag?.blockId === block.id && resizePreview !== null ? resizePreview : block.durationMinutes;
            const height = Math.max(duration * PIXEL_PER_MINUTE, MIN_DURATION * PIXEL_PER_MINUTE) - 2;
            const availableWidth = `calc(100% - ${LABEL_WIDTH + 6}px)`;
            const colWidth = `calc(${availableWidth} / ${layout.totalColumns} - 2px)`;
            const colLeft = `calc(${LABEL_WIDTH}px + ${availableWidth} * ${layout.column} / ${layout.totalColumns})`;
            const done = isDone(block);
            const contact = block.contactId ? contacts.find(c => c.id === block.contactId) : undefined;
            const compact = height < 34;

            return (
              <div
                key={block.id}
                data-block
                role="button"
                aria-label={`${block.title || cat.name}, ${formatTime(blockStartMinutes(block))}`}
                className={cn('absolute overflow-hidden rounded-xl border-l-[4px] transition-shadow',
                  isDragging ? 'z-30 scale-[1.02] cursor-grabbing opacity-90 shadow-xl' : 'z-10 cursor-pointer active:brightness-95')}
                style={{
                  top, height, left: colLeft, width: colWidth,
                  backgroundColor: `hsl(${cat.color} / ${done ? 0.08 : 0.16})`,
                  borderLeftColor: `hsl(${cat.color})`,
                  // Allow normal scrolling; a long-press picks the block up.
                  touchAction: 'pan-y',
                  WebkitTouchCallout: 'none',
                }}
                onPointerDown={(e) => handleBlockPointerDown(e, block.id)}
                onClick={(e) => { e.stopPropagation(); if (!dragging) setEditingBlock(block.id); }}
              >
                <div className={cn('flex h-full gap-2 px-2', compact ? 'items-center py-0' : 'items-start py-1.5')}>
                  {block.todoId && onToggleTodo && (
                    <button type="button" role="checkbox" aria-checked={done} aria-label={`Done: ${block.title}`}
                      onClick={(e) => { e.stopPropagation(); toggleDone(block); }}
                      className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center">
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2"
                        style={done ? { backgroundColor: `hsl(${cat.color})`, borderColor: `hsl(${cat.color})` } : { borderColor: `hsl(${cat.color})` }}>
                        {done && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                      </span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-footnote font-semibold leading-tight text-foreground', done && 'text-muted-foreground line-through')}>
                      {block.sourceTemplateId && <Repeat className="mr-1 inline h-3 w-3 align-[-1px] text-muted-foreground" />}
                      {block.title || <span className="text-muted-foreground">{cat.name}</span>}
                    </p>
                    {!compact && (
                      <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
                        {formatTime(blockStartMinutes(block))} – {formatTime(blockEndMinutes(block))}
                        {contact && <><User className="ml-1.5 mr-0.5 inline h-3 w-3 align-[-2px]" />{contact.name}</>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Drag the bottom edge to change the length */}
                <div
                  data-resize-handle
                  className="group absolute -bottom-1 left-0 right-0 flex h-5 cursor-ns-resize items-end justify-center pb-1.5"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => handleResizePointerDown(e, block.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to change length"
                >
                  <div className="h-1 w-8 rounded-full bg-foreground/20 group-hover:bg-foreground/40" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BlockSheet
        block={editing}
        contacts={contacts}
        backlogTodos={backlogTodos}
        todoDone={editing ? isDone(editing) : false}
        onUpdate={patch => editing && updateBlock(editing.id, patch)}
        onDelete={() => editing && deleteBlock(editing.id)}
        onToggleTodo={() => editing && toggleDone(editing)}
        onLogContact={c => setLogContact(c)}
        onEditCategories={() => setShowCategories(true)}
        onClose={() => setEditingBlock(null)}
      />
      <CategoriesSheet open={showCategories} onClose={() => setShowCategories(false)} />
      <QuickLogSheet contact={logContact} onClose={() => setLogContact(null)} />
    </div>
  );
}
