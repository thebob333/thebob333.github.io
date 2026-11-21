import type { Contact } from '@/lib/storage';
import { ringInfo } from '@/lib/people';
import { cn } from '@/lib/utils';

/** Initials on the person's circle color. */
export function Avatar({ contact, size = 40, className }: { contact: Pick<Contact, 'name' | 'circleRing'>; size?: number; className?: string }) {
  const initials = contact.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  const color = ringInfo(contact.circleRing).color;
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 70%, black))` }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
