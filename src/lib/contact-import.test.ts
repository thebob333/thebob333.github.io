import { describe, expect, it } from 'vitest';
import { findDuplicates, importedToContacts, normalizePhone, parseVCard } from './contact-import';

const card = (...lines: string[]) => ['BEGIN:VCARD', 'VERSION:3.0', ...lines, 'END:VCARD'].join('\r\n');

describe('parseVCard', () => {
  it('reads FN, TEL and EMAIL', () => {
    expect(parseVCard(card('FN:Sam Lee', 'TEL;TYPE=CELL:555-123-4567', 'EMAIL:sam@x.com'))).toEqual([
      { name: 'Sam Lee', phone: '555-123-4567', email: 'sam@x.com' },
    ]);
  });

  it('handles iPhone grouped properties (item1.TEL / item1.EMAIL)', () => {
    const vcf = card(
      'N:Lee;Sam;;;',
      'FN:Sam Lee',
      'item1.TEL;type=pref:+1 (555) 000-1111',
      'item1.X-ABLabel:_$!<Mobile>!$_',
      'item2.EMAIL;type=INTERNET;type=pref:sam@icloud.com',
    );
    expect(parseVCard(vcf)).toEqual([{ name: 'Sam Lee', phone: '+1 (555) 000-1111', email: 'sam@icloud.com' }]);
  });

  it('falls back to the structured N name', () => {
    expect(parseVCard(card('N:Doe;Jane;Q;Dr.;'))[0].name).toBe('Dr. Jane Q Doe');
  });

  it('unfolds long lines and decodes escapes', () => {
    const vcf = card('FN:Smith\\, Jr.', 'NOTE:a very long', '  line continues', 'EMAIL:long.addr', ' ess@x.com');
    expect(parseVCard(vcf)[0]).toEqual({ name: 'Smith, Jr.', email: 'long.address@x.com', phone: undefined });
  });

  it('reads vCard 2.1 with QUOTED-PRINTABLE names and bare TEL types', () => {
    const vcf = [
      'BEGIN:VCARD', 'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:M=C3=BCller;J=C3=BCrgen;;;',
      'TEL;CELL:0151 234',
      'END:VCARD',
    ].join('\n');
    expect(parseVCard(vcf)).toEqual([{ name: 'Jürgen Müller', phone: '0151 234', email: undefined }]);
  });

  it('prefers a mobile number when none is marked preferred', () => {
    const vcf = card('FN:A', 'TEL;TYPE=HOME:111', 'TEL;TYPE=CELL:222');
    expect(parseVCard(vcf)[0].phone).toBe('222');
  });

  it('parses many cards, lowercase keywords, and skips empty cards', () => {
    const vcf = [card('FN:One'), 'begin:vcard\nfn:Two\nend:vcard', card('NOTE:no name or phone')].join('\n');
    expect(parseVCard(vcf).map(c => c.name)).toEqual(['One', 'Two']);
  });

  it('uses the company name when there is no person name', () => {
    expect(parseVCard(card('ORG:Acme Inc.;Sales', 'TEL:123'))[0].name).toBe('Acme Inc.');
  });
});

describe('findDuplicates', () => {
  const existing = [
    { name: 'Sam Lee', phone: '(555) 123-4567', email: undefined },
    { name: 'Alex Kim', phone: undefined, email: 'ALEX@x.com' },
    { name: 'Jordan Fox', phone: undefined, email: undefined },
  ];

  it('matches phone numbers regardless of formatting and country code', () => {
    expect(normalizePhone('+1 555 123 4567')).toBe(normalizePhone('555-123-4567'));
    const r = findDuplicates([{ name: 'Samuel', phone: '+1 555 123 4567' }], existing);
    expect(r.duplicates).toHaveLength(1);
  });

  it('matches emails case-insensitively', () => {
    expect(findDuplicates([{ name: 'A.K.', email: 'alex@X.com' }], existing).duplicates).toHaveLength(1);
  });

  it('same name with a different phone is a different person', () => {
    const r = findDuplicates([{ name: 'Sam Lee', phone: '999-999-9999' }], existing);
    expect(r.unique).toHaveLength(1);
  });

  it('same name with no conflicting details counts as a duplicate', () => {
    expect(findDuplicates([{ name: 'jordan  fox' }], existing).duplicates).toHaveLength(1);
  });

  it('removes repeats within the same file', () => {
    const r = findDuplicates([
      { name: 'New Person', phone: '111' },
      { name: 'New Person', phone: '111' },
      { name: 'Other', email: 'o@x.com' },
      { name: 'Other Again', email: 'O@x.com' },
    ], []);
    expect(r.unique.map(c => c.name)).toEqual(['New Person', 'Other']);
    expect(r.duplicates).toHaveLength(2);
  });
});

describe('importedToContacts', () => {
  it('creates complete contacts with sensible defaults', () => {
    const [c] = importedToContacts([{ name: 'Sam', phone: '1' }]);
    expect(c).toMatchObject({ name: 'Sam', phone: '1', relationship: 'acquaintance', circleRing: 'distant', influenceTag: 'neutral', notes: '', plan: '' });
    expect(c.id).toBeTruthy();
    expect(c.createdAt).toBeTruthy();
  });
});
