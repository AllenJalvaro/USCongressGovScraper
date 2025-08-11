import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(stealthPlugin());

const isVercel = !!process.env.AWS_REGION;

async function getBrowserModules() {
  if (isVercel) {
    const { default: Chromium } = await import('@sparticuz/chromium');
    const executablePath = await Chromium.executablePath();

    return {
      puppeteer: puppeteerExtra,
      launchOptions: {
        args: Chromium.args,
        defaultViewport: Chromium.defaultViewport,
        executablePath,
        headless: 'new',
      },
    };
  } else {
    return {
      puppeteer: puppeteerExtra,
      launchOptions: {
        headless: 'new',
        slowMo: 50,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
      },
    };
  }
}

const BASE_URL = 'https://congress.gov';

export default async function handler(req, res) {
  const url = req.query.url;
  console.log('Scraping URL:', url);

  if (!url) {
    return res.status(400).json({ error: 'Missing required query parameter: url' });
  }

  let browser;
  try {
    const { puppeteer, launchOptions } = await getBrowserModules();

    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Optional: handle cookie consent (if needed)
    // const cookieBtnSelector = 'div.cc-overlay-footer button#accept.cc-overlay-button.cc-overlay-yes';
    // try {
    //   await page.waitForSelector(cookieBtnSelector, { timeout: 10000 });
    //   await page.click(cookieBtnSelector);
    //   await page.waitForTimeout(2000);
    // } catch {
    //   console.log('No cookie consent button found or timeout, continuing...');
    // }

    const data = await page.evaluate((BASE_URL) => {
      const items = Array.from(
        document.querySelectorAll('ol.basic-search-results-lists > li.compact')
      );
      if (!items.length) return [];

      return items
        .map((item) => {
          const legislationId =
            item.querySelector('.result-heading a')?.innerText.trim() || '';
          const title =
            item.querySelector('.result-title')?.innerText.trim() || '';
          const sourceRel =
            item.querySelector('.result-heading a')?.getAttribute('href') || '';
          const sourcelink = sourceRel.startsWith('http')
            ? sourceRel
            : BASE_URL + sourceRel;

          let pdflink = null;
          const latestActionSpan = Array.from(
            item.querySelectorAll('span.result-item')
          ).find((span) => span.textContent.includes('Latest Action'));

          if (latestActionSpan) {
            const pdfAnchor = latestActionSpan.querySelector('a[href$=".pdf"]');
            if (pdfAnchor) {
              const href = pdfAnchor.getAttribute('href');
              pdflink = href.startsWith('http') ? href : BASE_URL + href;
            }
          }

          let lawNo = null;
          if (latestActionSpan) {
            const lawAnchor = Array.from(
              latestActionSpan.querySelectorAll('a')
            ).find((a) => a.textContent.includes('Public Law No'));
            if (lawAnchor) lawNo = lawAnchor.textContent.trim();
          }

          return {
            legislationId,
            title,
            sourcelink,
            pdflink,
            lawNo,
          };
        })
        .filter(Boolean);
    }, BASE_URL);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Error during scraping:', err);
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}
