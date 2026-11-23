import { expect, it } from 'vitest';
import { foregroundReminderDue } from '../src/domain/reminders';

const now = new Date('2026-11-23T12:00:15Z');
it('never catches up on startup, after suspension, or after the clock moves backwards', () => {
  for (const previous of [null, now.getTime() - 61_000, now.getTime() + 30_000]) {
    expect(foregroundReminderDue(previous, now, 'Europe/Berlin', '13:00')).toBe(false);
  }
});
it('only delivers when the scheduled minute is reached while active', () => {
  const previous = now.getTime() - 30_000;
  expect(foregroundReminderDue(previous, now, 'Europe/Berlin', '13:00')).toBe(true);
  for (const time of ['12:59', '13:01', '', '25:00']) expect(foregroundReminderDue(previous, now, 'Europe/Berlin', time)).toBe(false);
  expect(foregroundReminderDue(now.getTime() - 10_000, now, 'Europe/Berlin', '13:00')).toBe(false);
});
it('uses the configured timezone and handles midnight and DST transitions', () => {
  for (const [instant, zone, time] of [
    ['2026-11-23T23:00:15Z', 'Europe/Berlin', '00:00'],
    ['2026-03-29T01:00:15Z', 'Europe/Berlin', '03:00'],
    ['2026-10-25T01:00:15Z', 'Europe/Berlin', '02:00'],
    ['2026-11-23T12:00:15Z', 'America/New_York', '07:00'],
  ]) {
    const date = new Date(instant);
    expect(foregroundReminderDue(date.getTime() - 30_000, date, zone, time)).toBe(true);
  }
  const spring = new Date('2026-03-29T01:00:15Z');
  expect(foregroundReminderDue(spring.getTime() - 30_000, spring, 'Europe/Berlin', '02:00')).toBe(false);
});
