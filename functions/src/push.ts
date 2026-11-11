import { z } from 'zod';

export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && url.pathname.length > 1
      && (url.hostname === 'web.push.apple.com' || /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname)
        || url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
        || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}

export const subscriptionSchema = z.object({
  endpoint: z.string().max(3000).refine(isAllowedPushEndpoint),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{20,30}={0,2}$/) }).strict(),
  updatedAt: z.string().datetime(),
}).strict();

/** Five-minute lateness window tolerates scheduler delays; the receipt prevents repeats. */
export function reminderOccurrence(now: Date, timeZone: string, time: string): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  // Walk real instants, then localize. This handles midnight and DST without
  // manufacturing a local time that did not exist during the spring transition.
  for (let offset = 0; offset < 5; offset++) {
    const parts = format.formatToParts(new Date(now.getTime() - offset * 60000));
    const get = (type: string) => parts.find(part => part.type === type)?.value;
    if (`${get('hour')}:${get('minute')}` === time) return `${get('year')}-${get('month')}-${get('day')}`;
  }
  return undefined;
}

export function reminderDue(now: Date, timeZone: string, time: string): boolean { return Boolean(reminderOccurrence(now, timeZone, time)); }
