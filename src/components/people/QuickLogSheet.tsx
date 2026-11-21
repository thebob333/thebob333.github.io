import type { Contact } from '@/lib/storage';
import { LogInteractionSheet } from './LogInteractionSheet';

/** Kept for existing callers (Today, Plan, Quick add): the same sheet as People. */
export function QuickLogSheet({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  return <LogInteractionSheet contact={contact} onClose={onClose} />;
}
