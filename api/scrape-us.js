import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import Chromium from '@sparticuz/chromium';

puppeteerExtra.use(stealthPlugin());

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: "Missing required query parameter: url" });
  }

  let browser;
  try {
    const executablePath = await Chromium.executablePath();

    browser = await puppeteerExtra.launch({
      headless: true,
      executablePath,
      args: Chromium.args,
      defaultViewport: Chromium.defaultViewport,
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    const data = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("ol.basic-search-results-lists > li.compact"));
      if (!items.length) return [];

      return items.map(item => {
        const legislationId = item.querySelector(".result-heading a")?.innerText.trim() || "";
        const title = item.querySelector(".result-title")?.innerText.trim() || "";
        const sourceRel = item.querySelector(".result-heading a")?.getAttribute("href") || "";
        const sourcelink = sourceRel.startsWith("http") ? sourceRel : "https://congress.gov" + sourceRel;

        let pdflink = null;
        const latestActionSpan = Array.from(item.querySelectorAll("span.result-item")).find(span => span.textContent.includes("Latest Action"));
        if (latestActionSpan) {
          const pdfAnchor = latestActionSpan.querySelector('a[href$=".pdf"]');
          if (pdfAnchor) {
            const href = pdfAnchor.getAttribute("href");
            pdflink = href.startsWith("http") ? href : "https://congress.gov" + href;
          }
        }

        let lawNo = null;
        if (latestActionSpan) {
          const lawAnchor = Array.from(latestActionSpan.querySelectorAll("a")).find(a => a.textContent.includes("Public Law No"));
          if (lawAnchor) lawNo = lawAnchor.textContent.trim();
        }

        return { legislationId, title, sourcelink, pdflink, lawNo };
      });
    });

    res.status(200).json(data);
  } catch (err) {
    console.error("Scraping error:", err);
    res.status(500).json({ error: "Scraping failed", details: err.message });
  } finally {
    if (browser) await browser.close();
  }
}
