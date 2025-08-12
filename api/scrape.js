import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: "Missing url query parameter" });
  }
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 45000 });

    const data = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("ol.basic-search-results-lists > li.compact")
      );
      if (!items.length) return [];

      return items.map((item) => {
        const legislationId =
          item.querySelector(".result-heading a")?.innerText.trim() || "";
        const title = item.querySelector(".result-title")?.innerText.trim() || "";
        const sourceRel =
          item.querySelector(".result-heading a")?.getAttribute("href") || "";
        const sourcelink = sourceRel.startsWith("http")
          ? sourceRel
          : "https://congress.gov" + sourceRel;

        let pdflink = null;
        const latestActionSpan = Array.from(
          item.querySelectorAll("span.result-item")
        ).find((span) => span.textContent.includes("Latest Action"));
        if (latestActionSpan) {
          const pdfAnchor = latestActionSpan.querySelector('a[href$=".pdf"]');
          if (pdfAnchor) {
            const href = pdfAnchor.getAttribute("href");
            pdflink = href.startsWith("http")
              ? href
              : "https://congress.gov" + href;
          }
        }

        let lawNo = null;
        if (latestActionSpan) {
          const lawAnchor = Array.from(
            latestActionSpan.querySelectorAll("a")
          ).find((a) => a.textContent.includes("Public Law No"));
          if (lawAnchor) lawNo = lawAnchor.textContent.trim();
        }

        return { legislationId, title, sourcelink, pdflink, lawNo };
      });
    });

    await browser.close();
    return res.status(200).json(data);
  } catch (err) {
    if (browser) await browser.close();
    console.error("Scraping error:", err);
    return res.status(500).json({ error: "Scraping failed", details: err.message });
  }
}
