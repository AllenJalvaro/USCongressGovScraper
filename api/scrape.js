import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import Chromium from "@sparticuz/chromium";
//here
puppeteerExtra.use(stealthPlugin());

const isVercel = !!process.env.AWS_REGION;

async function getExecutablePath() {
  if (isVercel) {
    return (await Chromium.executablePath()) || null;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url query parameter" });
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const executablePath = await getExecutablePath();

    const launchOptions = isVercel
      ? {
          args: Chromium.args,
          defaultViewport: Chromium.defaultViewport,
          executablePath,
          headless: true,
        }
      : {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        };

    const browser = await puppeteerExtra.launch(launchOptions);
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
        const title =
          item.querySelector(".result-title")?.innerText.trim() || "";
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
    res.status(200).json(data);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Scraping failed", details: error.message });
  }
}
