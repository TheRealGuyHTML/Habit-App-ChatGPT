import type { Day } from './types';

export function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

export function localDay(date = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): Day {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}

/** Calendar arithmetic uses UTC noon; local elapsed hours never define a day. */
export function addDays(day: Day, count: number): Day {
  if (!validDay(day) || !Number.isInteger(count)) throw new Error('Invalid calendar day');
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: Day, to: Day): number {
  if (!validDay(from) || !validDay(to)) throw new Error('Invalid calendar day');
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

/** Weekdays use the JS convention: Sunday=0, Monday=1. */
export function dayOfWeek(day: Day): number { return new Date(`${day}T12:00:00Z`).getUTCDay(); }

export function weekDays(day: Day): Day[] {
  const monday = addDays(day, -((dayOfWeek(day) + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function monthDays(day: Day): Day[] {
  const first = `${day.slice(0, 7)}-01`;
  const date = new Date(`${first}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const length = daysBetween(first, date.toISOString().slice(0, 10));
  return Array.from({ length }, (_, index) => addDays(first, index));
}

export function dateRange(from: Day, to: Day): Day[] {
  const length = daysBetween(from, to) + 1;
  return length > 0 ? Array.from({ length }, (_, index) => addDays(from, index)) : [];
}
