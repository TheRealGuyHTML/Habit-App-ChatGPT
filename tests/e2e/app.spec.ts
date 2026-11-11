import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { AppState } from '../../src/domain/types';

const errors = new WeakMap<Page, string[]>();
const fixedNow = new Date('2026-11-11T12:00:00Z');

test.beforeEach(async ({ page }) => {
  const captured: string[] = [];
  errors.set(page, captured);
  page.on('pageerror', error => captured.push(error.message));
  await page.clock.install({ time: fixedNow });
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? [], 'No uncaught application errors').toEqual([]);
});

async function openDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo mit Beispieldaten öffnen' }).click();
  await expect(page.getByRole('heading', { name: /Alex/ })).toBeVisible();
  await expect(page.locator('.habit-card')).toHaveCount(3);
}

function habitCard(page: Page, name: string): Locator {
  return page.locator('article.habit-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function navigate(page: Page, name: string) {
  const label = name === 'Dein Garten' ? 'Garten' : name;
  await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
}

async function openEditor(page: Page) {
  await navigate(page, 'Hinzufügen');
  const reviewMenu = page.getByRole('dialog').getByRole('button', { name: /^Habit hinzufügen/ });
  if (await reviewMenu.isVisible()) await reviewMenu.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Habit hinzufügen' })).toBeVisible();
  return dialog;
}

function xpValue(page: Page) {
  return page.locator('.garden-level-progress strong').innerText().then(value => Number(value.replace(/[^0-9]/g, '')));
}

test('onboarding recommends real habits, enforces three choices and persists the result', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Wie dürfen wir dich nennen? (optional)').fill('Mara');
  await page.locator('.area-option').filter({ hasText: 'Persönliches Wachstum' }).click();
  await page.getByRole('button', { name: 'Meine Empfehlungen' }).click();
  await page.locator('.recommendation').filter({ hasText: 'Wasser trinken' }).click();
  await page.locator('.recommendation').filter({ hasText: 'Ein Kapitel lesen' }).click();
  await page.locator('.recommendation').filter({ hasText: 'Erholsam schlafen' }).click();
  await expect(page.locator('.selection-count')).toHaveText('3 / 3 ausgewählt');
  await expect(page.locator('.recommendation').filter({ hasText: 'Obst & Gemüse essen' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mein Wachstum beginnt' }).click();
  await expect(page.getByRole('heading', { name: /Mara/ })).toBeVisible();
  await expect(page.locator('.habit-card')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Mara/ })).toBeVisible();
  await expect(page.locator('.habit-card')).toHaveCount(3);
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker')).toHaveCount(0);
});

test('demo counters persist across reloads and synchronize between open tabs', async ({ page, context }, testInfo) => {
  await openDemo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-home.png'), fullPage: true });
  const water = habitCard(page, 'Wasser trinken');
  await expect(water.locator('.tracker-count strong')).toHaveText('600');
  await water.getByRole('button', { name: '100 ml hinzufügen', exact: true }).click();
  await expect(water.locator('.tracker-count strong')).toHaveText('700');
  await page.reload();
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('700');
  const sibling = await context.newPage();
  // Open tabs share a wall clock; avoid resetting the second tab behind earlier writes.
  await sibling.clock.install({ time: new Date(await page.evaluate(() => Date.now())) });
  await sibling.goto('/');
  await expect(habitCard(sibling, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('700');
  await habitCard(sibling, 'Wasser trinken').getByRole('button', { name: '100 ml hinzufügen', exact: true }).click();
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('800');
  await habitCard(page, 'Wasser trinken').getByRole('button', { name: '100 ml weniger', exact: true }).click();
  await expect(habitCard(sibling, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('700');
  await sibling.close();
});

test('habits can be created, completed, paused and resumed without losing history', async ({ page }) => {
  await openDemo(page);
  const editor = await openEditor(page);
  await editor.getByLabel('Name', { exact: true }).fill('Abendspaziergang Test');
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  const added = habitCard(page, 'Abendspaziergang Test');
  await expect(added).toBeVisible();
  await added.getByRole('button', { name: 'Abendspaziergang Test: Als erledigt markieren' }).click();
  await expect(added.getByRole('button', { name: 'Abendspaziergang Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(habitCard(page, 'Abendspaziergang Test').getByRole('button', { name: 'Abendspaziergang Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await habitCard(page, 'Wasser trinken').getByRole('button', { name: 'Aktionen: Wasser trinken', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pausieren', exact: true }).click();
  await expect(habitCard(page, 'Wasser trinken')).toHaveCount(0);
  await page.getByLabel('Datum wählen').fill('2026-11-10');
  await expect(habitCard(page, 'Wasser trinken')).toBeVisible();
  await expect(page.locator('.history-notice')).toContainText('vergangenen Tag');
  await page.getByLabel('Datum wählen').fill('2026-11-11');
  await expect(habitCard(page, 'Wasser trinken')).toHaveCount(0);
  await page.getByRole('button', { name: 'Alle Habits verwalten', exact: true }).click();
  const management = page.getByRole('dialog');
  await management.getByRole('button', { name: /Wasser trinken/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await expect(habitCard(page, 'Wasser trinken')).toBeVisible();
});

test('language, theme and exported data survive reload and an import restores the backup', async ({ page }, testInfo) => {
  await openDemo(page);
  await navigate(page, 'Einstellungen');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('bloom-backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as AppState;
  expect(Object.keys(backup.habits)).toHaveLength(3);
  expect(backup.entries['demo-water_2026-11-11'].value).toBe(600);
  await page.getByLabel('Dein Vorname', { exact: true }).fill('Ava');
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await navigate(page, 'Settings');
  await expect(page.getByLabel('Your first name', { exact: true })).toHaveValue('Ava');
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(page.getByText('Review import', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Replace data', exact: true }).click();
  await expect(page.getByText(/Daten erfolgreich importiert\.|Data imported successfully\./)).toBeVisible();
  await expect(page.getByLabel('Dein Vorname', { exact: true })).toHaveValue('Alex');
  await expect(page.getByRole('button', { name: 'System', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await navigate(page, 'Einstellungen');
  await expect(page.getByLabel('Dein Vorname', { exact: true })).toHaveValue('Alex');
});

test('statistics show real periods and history; reviews award willpower XP only once', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Statistiken');
  await expect(page.getByRole('heading', { name: 'Kleine Schritte. Große Wirkung.' })).toBeVisible();
  await page.locator('.completion-card').getByRole('button', { name: 'Heute', exact: true }).click();
  await expect(page.locator('.completion-donut strong')).toHaveText('0%');
  await page.locator('.completion-card').getByRole('button', { name: '7 Tage', exact: true }).click();
  await expect(page.locator('.completion-donut strong')).not.toHaveText('0%');
  await page.getByLabel('Gewohnheit auswählen').selectOption('demo-water');
  await page.getByRole('button', { name: '10. November: Erledigt', exact: true }).click();
  await expect(page.locator('.calendar-day-detail')).toContainText('Erledigt');
  await navigate(page, 'Heute');
  const water = habitCard(page, 'Wasser trinken');
  for (let index = 0; index < 14; index++) await water.getByRole('button', { name: '100 ml hinzufügen', exact: true }).click();
  await expect(water.getByRole('button', { name: 'Wasser trinken: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await navigate(page, 'Dein Garten');
  const xpBefore = await xpValue(page);
  await page.getByRole('button', { name: 'Deine letzten XP', exact: true }).click();
  await expect(page.locator('.xp-ledger')).toContainText('Wasser trinken');
  await navigate(page, 'Einstellungen');
  await page.getByRole('switch', { name: /Daily Review/ }).check();
  await navigate(page, 'Heute');
  await navigate(page, 'Hinzufügen');
  await page.getByRole('dialog').getByRole('button', { name: /^Daily Review/ }).click();
  let review = page.locator('.daily-review');
  const waterRating = review.locator('.review-habit').filter({ hasText: 'Wasser trinken' });
  await waterRating.getByRole('button', { name: 'Wie schwer war der Anfang? 4/5', exact: true }).click();
  await review.getByRole('textbox', { name: 'Was möchtest du mitnehmen?', exact: true }).fill('Trotz Widerstand habe ich angefangen.');
  await review.getByRole('button', { name: 'Review speichern', exact: true }).click();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore + 10);
  await navigate(page, 'Hinzufügen');
  await page.getByRole('dialog').getByRole('button', { name: /^Daily Review/ }).click();
  review = page.locator('.daily-review');
  await expect(review.getByRole('textbox', { name: 'Was möchtest du mitnehmen?', exact: true })).toHaveValue('Trotz Widerstand habe ich angefangen.');
  await review.getByRole('button', { name: 'Review aktualisieren', exact: true }).click();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore + 10);
  await page.reload();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore + 10);
});

test('a negative habit stays preselected and receives its XP after local day end exactly once', async ({ page }) => {
  await openDemo(page);
  await navigate(page, 'Dein Garten');
  const xpBefore = await xpValue(page);
  const editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Kein Fastfood/ }).click();
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  await navigate(page, 'Heute');
  const negative = habitCard(page, 'Kein Fastfood');
  await expect(negative.getByRole('button', { name: 'Kein Fastfood: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await negative.getByRole('button', { name: 'Kein Fastfood: Erledigung zurücknehmen' }).click();
  await expect(negative.getByRole('button', { name: 'Kein Fastfood: Als erledigt markieren' })).toHaveAttribute('aria-pressed', 'false');
  await negative.getByRole('button', { name: 'Kein Fastfood: Als erledigt markieren' }).click();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore);
  await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
  await page.reload();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore + 25);
  await page.reload();
  await navigate(page, 'Dein Garten');
  expect(await xpValue(page)).toBe(xpBefore + 25);
  await navigate(page, 'Heute');
  await page.getByLabel('Datum wählen').fill('2026-11-11');
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('600');
  await expect(habitCard(page, 'Kein Fastfood').getByRole('button', { name: 'Kein Fastfood: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
});

test('configured checklist and journal controls persist real progress and text', async ({ page }) => {
  await openDemo(page);
  let editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Vitamine nehmen/ }).click();
  await editor.getByRole('switch', { name: /Spezial-Tracker aktivieren/ }).check();
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  let vitamins = habitCard(page, 'Vitamine nehmen');
  await vitamins.getByRole('button', { name: /Unteraufgaben/ }).click();
  await vitamins.getByRole('checkbox', { name: 'Vitamin D', exact: true }).check();
  await expect(vitamins.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  await vitamins.getByRole('checkbox', { name: 'Magnesium', exact: true }).check();
  await expect(vitamins.getByRole('button', { name: 'Vitamine nehmen: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  vitamins = habitCard(page, 'Vitamine nehmen');
  await vitamins.getByRole('button', { name: /Unteraufgaben/ }).click();
  await expect(vitamins.getByRole('checkbox', { name: 'Magnesium', exact: true })).toBeChecked();
  editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Gedanken festhalten/ }).click();
  await editor.getByRole('switch', { name: /Spezial-Tracker aktivieren/ }).check();
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  let journal = habitCard(page, 'Gedanken festhalten');
  await journal.getByRole('button', { name: 'Gut', exact: true }).click();
  await journal.getByLabel('Dein Highlight oder ein dankbarer Gedanke (optional)').fill('Ein Spaziergang im Herbstlicht.');
  await expect(journal.getByRole('button', { name: 'Gedanken festhalten: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  journal = habitCard(page, 'Gedanken festhalten');
  await expect(journal.getByRole('button', { name: 'Gut', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(journal.getByLabel('Dein Highlight oder ein dankbarer Gedanke (optional)')).toHaveValue('Ein Spaziergang im Herbstlicht.');
});

test('a running meditation timer survives reload and completes the habit at its configured goal', async ({ page }) => {
  await openDemo(page);
  const editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Zeit für mich/ }).click();
  await editor.getByLabel('Name', { exact: true }).fill('Meditation Test');
  await editor.getByRole('switch', { name: /Spezial-Tracker aktivieren/ }).check();
  await editor.getByLabel('Dein Ziel', { exact: true }).fill('1');
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  await habitCard(page, 'Meditation Test').getByRole('button', { name: 'Timer starten', exact: true }).click();
  await page.clock.runFor(10_000);
  await page.reload();
  await expect(habitCard(page, 'Meditation Test').getByRole('button', { name: 'Timer pausieren', exact: true })).toBeVisible();
  await page.clock.runFor(51_000);
  await expect(habitCard(page, 'Meditation Test').getByRole('button', { name: 'Meditation Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(habitCard(page, 'Meditation Test').getByRole('button', { name: 'Meditation Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
});

test('installed service worker serves the app offline and keeps offline edits after reconnect', async ({ page, context }) => {
  await openDemo(page);
  await habitCard(page, 'Wasser trinken').getByRole('button', { name: '100 ml hinzufügen', exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('700');
  await habitCard(page, 'Wasser trinken').getByRole('button', { name: '100 ml hinzufügen', exact: true }).click();
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('800');
  await context.setOffline(false);
  await page.reload();
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('800');
});

test('dialogs keep keyboard focus, close with Escape or a backdrop tap and restore focus', async ({ page }) => {
  await openDemo(page);
  const addButton = page.getByRole('button', { name: 'Hinzufügen', exact: true });
  await addButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(addButton).toBeFocused();
  await addButton.click();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.y).toBeGreaterThan(0);
  await page.mouse.click(5, dialogBox!.y / 2);
  await expect(dialog).toHaveCount(0);
  await expect(addButton).toBeFocused();
});

test('card gestures complete once, edit left, open long-press actions and keep pointer capture outside the card', async ({ page }) => {
  await openDemo(page);
  let editor = await openEditor(page);
  await editor.getByLabel('Name', { exact: true }).fill('Gesten Test');
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();

  async function swipe(card: Locator, direction: 'left' | 'right', releaseOutside = false) {
    // Center the card so the fixed bottom navigation cannot cover the gesture start.
    await card.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const cardBox = await card.boundingBox();
    const titleBox = await card.getByRole('heading').boundingBox();
    expect(cardBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    const start = {
      x: direction === 'right' ? titleBox!.x + 8 : titleBox!.x + titleBox!.width / 2,
      y: titleBox!.y + titleBox!.height / 2,
    };
    const end = {
      x: direction === 'right' ? Math.min(385, start.x + 240) : Math.max(5, start.x - 150),
      y: releaseOutside ? cardBox!.y + cardBox!.height + 18 : start.y,
    };
    expect(await card.evaluate((element, point) => {
      const target = document.elementFromPoint(point.x, point.y);
      return element.contains(target) && !target?.closest('button,input,select,textarea,a,summary');
    }, start), 'Gesture begins on a noninteractive part of the card').toBe(true);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    if (releaseOutside) {
      expect(await card.evaluate((element, point) => !element.contains(document.elementFromPoint(point.x, point.y)), end), 'Pointer is outside the card before release').toBe(true);
    }
    await page.mouse.up();
    await expect(card).toHaveCSS('transform', 'none');
  }

  const simple = habitCard(page, 'Gesten Test');
  await swipe(simple, 'right', true);
  await expect(simple.getByRole('button', { name: 'Gesten Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await swipe(simple, 'right');
  await expect(simple.getByRole('button', { name: 'Gesten Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await swipe(simple, 'left');
  editor = page.getByRole('dialog');
  await expect(editor.getByRole('heading', { name: 'Habit bearbeiten', exact: true })).toBeVisible();
  await expect(editor.getByLabel('Name', { exact: true })).toHaveValue('Gesten Test');
  await page.keyboard.press('Escape');

  await simple.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const title = await simple.getByRole('heading').boundingBox();
  await page.mouse.move(title!.x + 8, title!.y + title!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(600);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Pausieren', exact: true })).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press('Escape');

  editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Kein Fastfood/ }).click();
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  const negative = habitCard(page, 'Kein Fastfood');
  await swipe(negative, 'right');
  await swipe(negative, 'right');
  await expect(negative.getByRole('button', { name: 'Kein Fastfood: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(habitCard(page, 'Gesten Test').getByRole('button', { name: 'Gesten Test: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
  await expect(habitCard(page, 'Kein Fastfood').getByRole('button', { name: 'Kein Fastfood: Erledigung zurücknehmen' })).toHaveAttribute('aria-pressed', 'true');
});

test('an oversized checklist is rejected before saving and the existing data survives reload', async ({ page }) => {
  await openDemo(page);
  const editor = await openEditor(page);
  await editor.locator('.template-list').getByRole('button', { name: /Vitamine nehmen/ }).click();
  await editor.getByRole('switch', { name: /Spezial-Tracker aktivieren/ }).check();
  await editor.getByRole('textbox', { name: 'Unterpunkte (ein Eintrag pro Zeile)', exact: true }).fill(Array.from({ length: 51 }, (_, index) => `Unterpunkt ${index + 1}`).join('\n'));
  await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(editor.getByRole('alert')).toHaveText('Maximal 50 Unterpunkte mit jeweils höchstens 140 Zeichen.');
  await expect(editor).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.habit-card')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.habit-card')).toHaveCount(3);
  await expect(habitCard(page, 'Wasser trinken').locator('.tracker-count strong')).toHaveText('600');
});

test('desktop presents a responsive working dashboard and navigation @desktop', async ({ page }, testInfo) => {
  await openDemo(page);
  await expect(page.locator('.home-aside')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('desktop-home.png'), fullPage: true });
  await navigate(page, 'Statistiken');
  await expect(page.locator('.week-chart-column')).toHaveCount(7);
  await navigate(page, 'Dein Garten');
  await expect(page.locator('.achievement-card')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
