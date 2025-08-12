const isVercelEnvironment = !!process.env.AWS_REGION;

async function getBrowserModules() {
  const puppeteerExtra = (await import('puppeteer-extra')).default;
  const stealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  puppeteerExtra.use(stealthPlugin());

  const { default: ChromiumClass } = await import('@sparticuz/chromium');

  let executablePathValue = null;
  if (typeof ChromiumClass.executablePath === 'function') {
    executablePathValue = await ChromiumClass.executablePath();
  } else {
    executablePathValue = ChromiumClass.executablePath;
  }

  return {
    puppeteer: puppeteerExtra,
    chromiumArgs: ChromiumClass.args,
    chromiumDefaultViewport: ChromiumClass.defaultViewport,
    executablePath: executablePathValue
  };
}

export default async function handler(req, res) {
  const { puppeteer, chromiumArgs, chromiumDefaultViewport, executablePath } =
    await getBrowserModules();

  const rawUrlParts = req.query.url;
  if (!rawUrlParts || !rawUrlParts.length) {
    return res.status(400).json({ error: "Missing target URL" });
  }

  const targetUrl = decodeURIComponent(rawUrlParts.join("/"));
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const launchOptions = isVercelEnvironment
    ? {
        args: chromiumArgs,
        defaultViewport: chromiumDefaultViewport,
        executablePath: executablePath,
        headless: true
      }
    : {
        headless: true,
        defaultViewport: null,
        slowMo: 50,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
      };

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 45000 });

    const data = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("ol.basic-search-results-lists > li.compact")
      );
      if (!items.length) return [];

      return items.map(item => {
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
        ).find(span => span.textContent.includes("Latest Action"));
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
          ).find(a => a.textContent.includes("Public Law No"));
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
