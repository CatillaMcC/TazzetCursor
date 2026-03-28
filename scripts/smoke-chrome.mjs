/**
 * Headless browser smoke test (Chromium engine; tries Google Chrome if installed).
 * Run with: node scripts/smoke-chrome.mjs
 * Server must be listening on PORT (default 3000).
 */
import { chromium } from 'playwright';

const base = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    console.log('Using installed Google Chrome.');
  } catch {
    browser = await chromium.launch({ headless: true });
    console.log('Using Playwright Chromium bundle.');
  }

  const page = await browser.newPage();

  const healthRes = await page.goto(`${base}/health`, { waitUntil: 'domcontentloaded' });
  if (!healthRes || !healthRes.ok()) throw new Error(`/health HTTP ${healthRes?.status()}`);
  const healthText = await page.textContent('body');
  const health = JSON.parse(healthText.trim());
  if (health.status !== 'ok') throw new Error(`health.status: ${health.status}`);
  console.log('OK /health →', { status: health.status, dbConnected: health.dbConnected });

  const loginRes = await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  if (!loginRes || !loginRes.ok()) throw new Error(`/login HTTP ${loginRes?.status()}`);
  const loginTitle = await page.title();
  if (!/sign in|tazzet/i.test(loginTitle)) throw new Error(`unexpected login title: ${loginTitle}`);
  console.log('OK /login → title:', loginTitle);

  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForURL(/\/login/, { timeout: 10000 });
  console.log('OK / (no session) → redirected to login');

  await browser.close();
  console.log('All smoke checks passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
