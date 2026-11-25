import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

const site = process.env.QUERY_CLINIC_SITE_URL;
assert.ok(site, 'Set QUERY_CLINIC_SITE_URL to the deployed report URL.');
const reportUrl = new URL('data.json', site.endsWith('/') ? site : `${site}/`);
const expected = await readFile(new URL('../report/data.json', import.meta.url), 'utf8');

// Pages can report success before the new artifact reaches the public cache.
let current = '';
for (let attempt = 0; attempt < 6; attempt += 1) {
  try {
    const response = await fetch(reportUrl, { signal: AbortSignal.timeout(5000) });
    current = response.ok ? await response.text() : '';
  } catch {
    current = '';
  }
  if (current === expected) break;
  if (attempt < 5) await delay(5000);
}
assert.equal(current === expected, true, 'Public report does not match the deployment source.');

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  const response = await page.goto(site, { timeout: 15_000 });
  assert.ok(response?.ok(), 'The published workbench must open.');
  await page.locator('#report').waitFor({ state: 'visible' });
  const { resultRows, candidate } = JSON.parse(expected);
  assert.equal(await page.locator('#parity').textContent(), `${resultRows} rows matched`);
  assert.equal(await page.locator('#candidate-tree').getByRole('button').first().textContent(),
    candidate.plan['Node Type']);
  await page.getByRole('tab', { name: 'SQL & methodology' }).click();
  assert.equal(await page.locator('#sql').isVisible(), true);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download JSON' }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), 'query-clinic-report.json');
  assert.equal(await readFile(await download.path(), 'utf8'), expected);
  assert.deepEqual(errors, []);
  console.log('Published report rendered, SQL tab opened, and JSON downloaded unchanged.');
} finally {
  await browser.close();
}
