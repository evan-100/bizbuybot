import { firefox, webkit, chromium } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.105 Safari/537.36',
];

export function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function normalizeUrl(url) {
  if (!url) return '';
  let u = String(url).trim();
  // BizBuySell requires uppercase /Business-Opportunity/
  if (u.includes('bizbuysell.com') && u.includes('/business-opportunity/')) {
    u = u.replace('/business-opportunity/', '/Business-Opportunity/');
  }
  return u;
}

export function htmlToText(html) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}

export function normalizePrice(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim();
  if (!s) return null;

  const m = s.match(/^\$?\s*([\d,]+(?:\.\d+)?)\s*([KkMm])?/);
  if (!m) return null;

  let num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return null;

  const suffix = m[2];
  if (suffix) {
    const lower = suffix.toLowerCase();
    if (lower === 'k') num *= 1000;
    else if (lower === 'm') num *= 1000000;
  }

  return Math.round(num);
}

export async function fetchPage(rawUrl) {
  const url = normalizeUrl(rawUrl);

  let referer = 'https://www.google.com/';
  if (url.includes('bizbuysell.com')) {
    referer = 'https://www.bizbuysell.com/businesses-for-sale/';
  } else if (url.includes('bizquest.com')) {
    referer = 'https://www.bizquest.com/businesses-for-sale/';
  }

  const browserEngines = [
    { name: 'firefox', engine: firefox, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0' },
    { name: 'webkit', engine: webkit, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15' },
    { name: 'chromium', engine: chromium, ua: pickUserAgent() },
  ];

  for (const { name, engine, ua } of browserEngines) {
    let browser;
    try {
      browser = await engine.launch({
        headless: true,
        args: name === 'chromium' ? ['--disable-blink-features=AutomationControlled', '--no-sandbox'] : []
      });
      const context = await browser.newContext({
        userAgent: ua,
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        extraHTTPHeaders: {
          'Referer': referer,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const page = await context.newPage();

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Poll until challenge resolves
      for (let i = 0; i < 8; i++) {
        const title = await page.title().catch(() => '');
        const html = await page.content().catch(() => '');
        const bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');

        if (
          title &&
          !title.startsWith('Loading') &&
          !title.includes('Access Denied') &&
          bodyText &&
          bodyText.length > 500 &&
          !bodyText.trim().startsWith('Not found.') &&
          !html.includes('<h1>Access Denied</h1>')
        ) {
          await browser.close();
          return { html, title, text: bodyText };
        }
        await page.waitForTimeout(1000);
      }

      await browser.close();
    } catch (err) {
      if (browser) await browser.close();
    }
  }

  console.error(`[scraper] fetchPage failed for ${url} across all browser engines`);
  return null;
}
