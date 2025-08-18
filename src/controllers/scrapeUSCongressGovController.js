const { puppeteer, launchOptions } = require("../utils/puppeteerConfig");

async function scrapeCongressData(targetUrl) {
  let browser;
  try {
    const options = { ...launchOptions };
    if (typeof options.executablePath === "function") {
      options.executablePath = await options.executablePath();
    }

    browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    // await page.goto(targetUrl, {
    //   waitUntil: "domcontentloaded",
    //   timeout: 60000,
    // });

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60000 });

    await page
      .waitForSelector(
        "ol.basic-search-results-lists.expanded-view > li.compact",
        {
          timeout: 120000,
        }
      )
      .catch(async (err) => {
        console.error(
          "Selector not found! Possible bot-block or page load issue."
        );

        const html = await page.content();
        console.log(
          "PAGE HTML snapshot (first 1000 chars):",
          html.slice(0, 1000)
        );

        throw err;
      });

    return await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll(
          "ol.basic-search-results-lists.expanded-view > li.compact, ol.basic-search-results-lists > li.compact"
        )
      );

      const length = items.length;

      const results = items.map((item) => {
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

      return { length, results };
    });
  } finally {
    console.log(
      "Closing browser:",
      typeof browser,
      browser ? "exists" : "not launched"
    );
    if (browser) await browser.close();
  }
}

module.exports = { scrapeCongressData };
