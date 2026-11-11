import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint, reminderDue, reminderOccurrence, subscriptionSchema } from './push';

describe('push endpoint safety', () => {
  it.each([
    'https://web.push.apple.com/Q123', 'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/123', 'https://wns2.notify.windows.com/w/?token=abc',
  ])('allows known push service %s', endpoint => expect(isAllowedPushEndpoint(endpoint)).toBe(true));
  it.each([
    'http://web.push.apple.com/token', 'https://web.push.apple.com.evil.test/token',
    'https://evil.test/token', 'https://127.0.0.1/token', 'https://169.254.169.254/computeMetadata/v1',
    'https://name:password@fcm.googleapis.com/token', 'https://fcm.googleapis.com:8443/token',
    'https://fcm.googleapis.com/token#fragment', 'file:///etc/passwd', 'not a URL',
  ])('rejects unsafe target %s', endpoint => expect(isAllowedPushEndpoint(endpoint)).toBe(false));
  it('validates both encryption keys and timestamp', () => {
    const valid = { endpoint: 'https://web.push.apple.com/token', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) }, updatedAt: '2026-11-11T12:00:00.000Z' };
    expect(subscriptionSchema.safeParse(valid).success).toBe(true);
    expect(subscriptionSchema.safeParse({ ...valid, keys: { ...valid.keys, auth: 'bad' } }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ ...valid, redirect: 'http://localhost' }).success).toBe(false);
  });
});

describe('local reminder occurrence', () => {
  it('uses the profile timezone and bounded lateness', () => {
    const now = new Date('2026-11-11T19:03:00Z');
    expect(reminderDue(now, 'Europe/Berlin', '20:00')).toBe(true);
    expect(reminderDue(now, 'Europe/Berlin', '19:59')).toBe(true);
    expect(reminderDue(now, 'Europe/Berlin', '19:58')).toBe(false);
    expect(reminderDue(now, 'Europe/Berlin', '20:04')).toBe(false);
    expect(reminderDue(now, 'America/New_York', '20:00')).toBe(false);
  });
  it('keeps a late 23:59 reminder on its actual local day', () => {
    expect(reminderOccurrence(new Date('2026-11-11T23:01:00Z'), 'Europe/Berlin', '23:59')).toBe('2026-11-11');
  });
  it('does not invent nonexistent spring DST time', () => {
    expect(reminderDue(new Date('2026-03-29T01:01:00Z'), 'Europe/Berlin', '02:59')).toBe(false);
    expect(reminderOccurrence(new Date('2026-03-29T01:01:00Z'), 'Europe/Berlin', '01:59')).toBe('2026-03-29');
  });
  it('uses the same day receipt for repeated winter DST time', () => {
    const first = reminderOccurrence(new Date('2026-10-25T00:31:00Z'), 'Europe/Berlin', '02:30');
    const repeated = reminderOccurrence(new Date('2026-10-25T01:31:00Z'), 'Europe/Berlin', '02:30');
    expect(first).toBe('2026-10-25'); expect(repeated).toBe(first);
  });
  it.each(['25:00', '09:99', '9:00', 'bad'])('rejects invalid reminder time %s', time => expect(reminderDue(new Date(), 'UTC', time)).toBe(false));
});
