const isVercelEnvironment = !!process.env.AWS_REGION;

async function getBrowserModules() {
  const puppeteer = await import("puppeteer-core");
  const { default: ChromiumClass } = await import("@sparticuz/chromium");

  console.log("--- Debugging ChromiumClass object (Vercel) ---");
  console.log("Type of ChromiumClass:", typeof ChromiumClass);
  console.log("Keys of ChromiumClass:", Object.keys(ChromiumClass));
  console.log("Full ChromiumClass object:", ChromiumClass);
  console.log(
    "ChromiumClass.executablePath is a function:",
    typeof ChromiumClass.executablePath === "function"
  );
  console.log("ChromiumClass.args:", ChromiumClass.args);
  console.log("ChromiumClass.defaultViewport:", ChromiumClass.defaultViewport);
  console.log("--- End ChromiumClass Debug (Vercel) ---");

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

export default async function (req, res) {
  const { puppeteer, chromiumArgs, chromiumDefaultViewport, executablePath } =
    await getBrowserModules();

  console.log("--- Puppeteer Launch Debug Info (Vercel) ---");
  console.log("isVercelEnvironment:", isVercelEnvironment);
  console.log("chromiumArgs (from @sparticuz/chromium):", chromiumArgs);
  console.log(
    "chromiumDefaultViewport (from @sparticuz/chromium):",
    chromiumDefaultViewport
  );
  console.log("Executable Path (from @sparticuz/chromium):", executablePath);
  console.log("--- End Debug Info (Vercel) ---");

  if (
    isVercelEnvironment &&
    (!executablePath ||
      typeof executablePath !== "string" ||
      executablePath.trim() === "")
  ) {
    console.error(
      "ERROR: In Vercel environment, executablePath is not valid:",
      executablePath
    );
    return res.status(500).json({
      error:
        "Puppeteer launch failed: Missing or invalid Chromium executable path for Vercel environment.",
    });
  }
  try {
    const targetUrl =  "https://www.congress.gov/search?q=%7B%22source%22%3A%22legislation%22%2C%22congress%22%3A%22all%22%2C%22bill-status%22%3A%22law%22%7D&pageSize=250";
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url query parameter" });
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL format" });
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
          defaultViewport: null,
          slowMo: 50,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        };

    let browser;
    console.log(
      "Attempting to launch Puppeteer with options:",
      JSON.stringify(launchOptions, null, 2)
    );

    

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    const data = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("ol.basic-search-results-lists > li.compact")
      );
      if (!items.length) return [];

      return items.map((item) => {
        const legislationName =
          `${item.querySelector(".result-heading a")?.innerText.trim()} - ${item
            .querySelector(".result-title")
            ?.innerText.trim()}` || "";
        const displayTitle =
          item.querySelectorAll(".result-item a")[2]?.innerText.trim() || "";

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

        return { legislationName, displayTitle, sourcelink, pdflink };
      });
    });

    res.status(200).json(data);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Scraping failed", details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
