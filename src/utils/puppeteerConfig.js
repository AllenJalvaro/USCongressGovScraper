const isServerless = !!process.env.AWS_REGION;
let puppeteer;

if (isServerless) {
const chromium = await import("@sparticuz/chromium");
  puppeteer = await import("puppeteer-extra");
  const StealthPlugin = await import("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  module.exports = {
    puppeteer,
    launchOptions: {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: async () => await chromium.executablePath(),
      headless: chromium.headless,
    },
  };
} else {
   puppeteer = await import("puppeteer-extra");
  const StealthPlugin = await import("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  module.exports = {
    puppeteer,
    launchOptions: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  };
}
