const isVercelEnvironment = !!process.env.AWS_REGION;

async function getBrowserModules() {
  await import("puppeteer-extra-plugin-stealth/evasions/chrome.app/index.js");
  await import("puppeteer-extra-plugin-stealth/evasions/chrome.csi/index.js");
  await import(
    "puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/chrome.runtime/index.js"
  );
  await import("puppeteer-extra-plugin-stealth/evasions/defaultArgs/index.js");
  await import(
    "puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow/index.js"
  );
  await import("puppeteer-extra-plugin-stealth/evasions/media.codecs/index.js");
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.languages/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.permissions/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.plugins/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.vendor/index.js"
  );
  await import(
    "puppeteer-extra-plugin-stealth/evasions/navigator.webdriver/index.js"
  );
  await import("puppeteer-extra-plugin-stealth/evasions/sourceurl/index.js");
  await import(
    "puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js"
  );
  await import("puppeteer-extra-plugin-stealth/evasions/webgl.vendor/index.js");
  await import(
    "puppeteer-extra-plugin-stealth/evasions/window.outerdimensions/index.js"
  );
  const puppeteer = await import("puppeteer-extra");
  const stealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
    .default;
  const { default: ChromiumClass } = await import("@sparticuz/chromium");

  puppeteer.default.use(stealthPlugin());

  let executablePathValue = null;
  if (typeof ChromiumClass.executablePath === "function") {
    executablePathValue = await ChromiumClass.executablePath();
  } else {
    executablePathValue = ChromiumClass.executablePath;
  }

  return {
    puppeteer: puppeteer.default,
    chromiumArgs: ChromiumClass.args,
    chromiumDefaultViewport: ChromiumClass.defaultViewport,
    executablePath: executablePathValue,
  };
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

    const { puppeteer, chromiumArgs, chromiumDefaultViewport, executablePath } =
      await getBrowserModules();

    if (
      isVercelEnvironment &&
      (!executablePath ||
        typeof executablePath !== "string" ||
        executablePath.trim() === "")
    ) {
      console.error(
        "ERROR: Missing or invalid Chromium executable path on Vercel"
      );
      return res.status(500).json({
        error:
          "Puppeteer launch failed: Missing or invalid Chromium executable path for Vercel environment.",
      });
    }

    const launchOptions = isVercelEnvironment
      ? {
          args: chromiumArgs,
          defaultViewport: chromiumDefaultViewport,
          executablePath,
          headless: true,
        }
      : {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        };

    const browser = await puppeteer.launch(launchOptions);
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
