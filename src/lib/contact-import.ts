import { Contact, generateId } from '@/lib/storage';

export interface ImportedContact {
  name: string;
  phone?: string;
  email?: string;
}

// --- Contact Picker API (Android Chrome, some PWA browsers) ---

interface ContactPickerContact {
  name?: string[];
  email?: string[];
  tel?: string[];
}

interface ContactsManager {
  select(
    properties: string[],
    options?: { multiple?: boolean }
  ): Promise<ContactPickerContact[]>;
  getProperties(): Promise<string[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

export async function pickContactsFromPhone(): Promise<ImportedContact[]> {
  if (!navigator.contacts) {
    throw new Error('Contact Picker API not supported');
  }

  const supported = await navigator.contacts.getProperties();
  const properties = ['name', 'tel', 'email'].filter(p => supported.includes(p));

  const results = await navigator.contacts.select(properties, { multiple: true });

  return results
    .filter(c => c.name?.[0])
    .map(c => ({
      name: c.name![0].trim(),
      phone: c.tel?.[0] || undefined,
      email: c.email?.[0] || undefined,
    }));
}

// --- vCard (.vcf) parsing ---
// Handles vCard 2.1 / 3.0 / 4.0 as exported by iPhone Contacts, Google and
// Outlook: folded lines, grouped properties (item1.TEL), escaped characters,
// QUOTED-PRINTABLE values and multiple cards per file.

interface VProp {
  name: string; // upper-case, group stripped
  params: string[]; // upper-case raw params, e.g. ["TYPE=CELL", "PREF"]
  value: string; // decoded
  rawValue: string; // undecoded (needed to split N on unescaped ';')
}

function unfold(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  // RFC 6350 folding: a line starting with a space or tab continues the previous one.
  const unfolded = normalized.replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');
  // vCard 2.1 quoted-printable soft breaks: a QP line ending in "=" continues.
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /QUOTED-PRINTABLE/i.test(prev.split(':')[0]) && prev.endsWith('=')) {
      out[out.length - 1] = prev.slice(0, -1) + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Split on a separator that isn't escaped with a backslash. */
function splitUnescaped(value: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && i + 1 < value.length) {
      cur += ch + value[i + 1];
      i++;
    } else if (ch === sep) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function unescapeText(v: string): string {
  return v.replace(/\\([\\,;nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

function decodeQuotedPrintable(v: string, charset = 'utf-8'): string {
  const bytes: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(v.slice(i + 1, i + 3))) {
      bytes.push(parseInt(v.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(v.charCodeAt(i) & 0xff);
    }
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function parseLine(line: string): VProp | null {
  // The first unquoted ':' separates name+params from the value.
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const rawValue = line.slice(colon + 1);
  const [nameWithGroup, ...params] = head.split(';');
  const name = nameWithGroup.split('.').pop()!.trim().toUpperCase();
  const upperParams = params.map(p => p.trim().toUpperCase());

  let value = rawValue;
  const qp = upperParams.some(p => p === 'ENCODING=QUOTED-PRINTABLE' || p === 'QUOTED-PRINTABLE');
  if (qp) {
    const charsetParam = upperParams.find(p => p.startsWith('CHARSET='));
    value = decodeQuotedPrintable(rawValue, charsetParam ? charsetParam.slice(8).toLowerCase() : 'utf-8');
  } else {
    value = unescapeText(rawValue);
  }
  return { name, params: upperParams, value: value.trim(), rawValue };
}

/** Prefer a value marked preferred, then mobile/cell, then the first one. */
function pickBest(props: VProp[], mobileFirst = false): string | undefined {
  if (props.length === 0) return undefined;
  const has = (p: VProp, re: RegExp) => p.params.some(x => re.test(x));
  const pref = props.find(p => has(p, /(^|=|,)PREF(,|$)|PREF=1/));
  if (pref) return pref.value;
  if (mobileFirst) {
    const cell = props.find(p => has(p, /CELL|MOBILE|IPHONE/));
    if (cell) return cell.value;
  }
  return props[0].value;
}

function cardToContact(props: VProp[]): ImportedContact | null {
  const fn = props.find(p => p.name === 'FN')?.value;
  let name = fn || '';
  if (!name) {
    const n = props.find(p => p.name === 'N');
    if (n) {
      const parts = (n.params.some(p => p.includes('QUOTED-PRINTABLE')) ? n.value.split(';') : splitUnescaped(n.rawValue, ';').map(unescapeText))
        .map(s => s.trim());
      const [last = '', first = '', middle = '', prefix = '', suffix = ''] = parts;
      name = [prefix, first, middle, last, suffix].filter(Boolean).join(' ');
    }
  }
  if (!name) name = props.find(p => p.name === 'ORG')?.value.split(';')[0].trim() || '';

  const phone = pickBest(props.filter(p => p.name === 'TEL' && p.value), true);
  const email = pickBest(props.filter(p => p.name === 'EMAIL' && p.value));

  if (!name) name = email || phone || '';
  if (!name) return null;
  return { name: name.replace(/\s+/g, ' ').trim(), phone: phone || undefined, email: email || undefined };
}

export function parseVCard(vcfText: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  let current: VProp[] | null = null;

  for (const line of unfold(vcfText)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const upper = trimmed.toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      current = [];
      continue;
    }
    if (upper === 'END:VCARD') {
      if (current) {
        const c = cardToContact(current);
        if (c) contacts.push(c);
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseLine(trimmed);
    if (prop) current.push(prop);
  }

  return contacts;
}

export function readVCardFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// --- Duplicate detection ---

/** Digits only, compared on the last 10 so "+1 (555) 123-4567" matches "555-123-4567". */
export function normalizePhone(p?: string): string {
  const digits = (p || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const normEmail = (e?: string) => (e || '').trim().toLowerCase();
const normName = (n?: string) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');

interface Known {
  name: string;
  phone: string;
  email: string;
}

function isSamePerson(a: Known, b: Known): boolean {
  if (a.phone && b.phone && a.phone === b.phone) return true;
  if (a.email && b.email && a.email === b.email) return true;
  if (a.name && a.name === b.name) {
    // Same name: only a duplicate if their contact details don't contradict.
    const phonesConflict = a.phone && b.phone && a.phone !== b.phone;
    const emailsConflict = a.email && b.email && a.email !== b.email;
    return !phonesConflict && !emailsConflict;
  }
  return false;
}

/**
 * Split imported contacts into new people and duplicates — duplicates of
 * people already saved AND repeats within the same file.
 */
export function findDuplicates(
  imported: ImportedContact[],
  existing: Pick<Contact, 'name' | 'phone' | 'email'>[],
): { unique: ImportedContact[]; duplicates: ImportedContact[] } {
  const known: Known[] = existing.map(c => ({ name: normName(c.name), phone: normalizePhone(c.phone), email: normEmail(c.email) }));
  const unique: ImportedContact[] = [];
  const duplicates: ImportedContact[] = [];

  for (const contact of imported) {
    const k: Known = { name: normName(contact.name), phone: normalizePhone(contact.phone), email: normEmail(contact.email) };
    if (known.some(e => isSamePerson(e, k))) {
      duplicates.push(contact);
    } else {
      unique.push(contact);
      known.push(k);
    }
  }

  return { unique, duplicates };
}

// --- Convert imported contacts to app Contact objects ---

export function importedToContacts(imported: ImportedContact[], now = new Date()): Contact[] {
  const createdAt = now.toISOString();
  return imported.map(c => ({
    id: generateId(),
    createdAt,
    name: c.name,
    relationship: 'acquaintance' as const,
    circleRing: 'distant' as const,
    influenceTag: 'neutral' as const,
    phone: c.phone,
    email: c.email,
    notes: '',
    plan: '',
  }));
}
