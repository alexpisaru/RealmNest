import { describe, expect, it } from 'vitest';
import { dataText } from '../locales/data';

describe('world data in Italian', () => {
  it('maps names and labels, and the activities the simulation builds from them', () => {
    expect(dataText('it', 'Office')).toBe('Ufficio');
    expect(dataText('en', 'Office')).toBe('Office');
    expect(dataText('it', 'Working on “Fix flaky test” · Desk 3')).toBe('Al lavoro su “Sistemare il test instabile” · Scrivania 3');
    expect(dataText('it', 'On break · Lounge sofa')).toBe('In pausa · Divano del lounge');
    expect(dataText('it', 'Paused · “Draft Q3 report”')).toBe('Sospeso · “Bozza del report Q3”');
    expect(dataText('it', 'Chatting with Hana')).toBe('Chiacchiera con Hana');
    // a free text stays as it is
    expect(dataText('it', 'Research · reading example.com')).toBe('Ricerca · reading example.com');
    expect(dataText('it', undefined)).toBe('');
  });
});
