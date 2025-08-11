import puppeteer from "puppeteer";

const BASE_URL = "https://congress.gov";

export default async function scrapeUSCongressGov(req, res) {
  const url = req.query.url;
  console.log("Scraping URL:", url);
  if (!url) {
    res.status(400).json({ error: "Missing required query parameter: url" });
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    try {
      await page.goto(url, { waitUntil: "networkidle2" });
    } catch (navError) {
      console.error("Navigation failed:", navError);
      throw navError;
    }

    const data = await page.evaluate((BASE_URL) => {
      const items = Array.from(
        document.querySelectorAll("ol.basic-search-results-lists > li.compact")
      );
      if (!items.length) return [];

      return items
        .map((item) => {
          const legislationId =
            item.querySelector(".result-heading a")?.innerText.trim() || "";
          const title =
            item.querySelector(".result-title")?.innerText.trim() || "";
          const sourceRel =
            item.querySelector(".result-heading a")?.getAttribute("href") || "";
          const sourcelink = sourceRel.startsWith("http")
            ? sourceRel
            : BASE_URL + sourceRel;

          let pdflink = null;
          const latestActionSpan = Array.from(
            item.querySelectorAll("span.result-item")
          ).find((span) => span.textContent.includes("Latest Action"));
          if (latestActionSpan) {
            const pdfAnchor = latestActionSpan.querySelector('a[href$=".pdf"]');
            if (pdfAnchor) {
              const href = pdfAnchor.getAttribute("href");
              pdflink = href.startsWith("http") ? href : BASE_URL + href;
            }
          }

          let lawNo = null;
          if (latestActionSpan) {
            const lawAnchor = Array.from(
              latestActionSpan.querySelectorAll("a")
            ).find((a) => a.textContent.includes("Public Law No"));
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

    res.status(200).json(data);
  } catch (err) {
    console.error("Error during scraping:", err);
    res.status(500).json({ error: "Scraping failed" });
  } finally {
    if (browser) await browser.close();
  }
}
