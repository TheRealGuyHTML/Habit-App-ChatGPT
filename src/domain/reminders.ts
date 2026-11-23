/** Foreground fallback only: observe a scheduled minute while continuously active.
 * A missing baseline or a long gap means startup/resume, never a catch-up alarm.
 */
export function foregroundReminderDue(previous: number | null, now: Date, timeZone: string, time: string): boolean {
  const timestamp = now.getTime();
  if (previous === null || timestamp <= previous || timestamp - previous > 60_000
    || Math.floor(timestamp / 60_000) === Math.floor(previous / 60_000)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now) === time;
}
