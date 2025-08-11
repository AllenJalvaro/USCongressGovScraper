// const puppeteer = require("puppeteer");

// (async () => {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
//   await page.goto("https://quotes.toscrape.com/");
//   //   await page.screenshot({ path: "puppeteer_ss.png" });
//   try {
//     // await page.waitForSelector(
//     //   "#content .main-wrapper .row .column-equal p strong"
//     // );

//     const grabTitles = await page.evaluate(() => {
//       const quoteElements = document.querySelectorAll(".col-md-8 .quote ");

//       const titles = [];

//       quoteElements.forEach((el) => {
//         const quote =
//           el.querySelector("span.text")?.innerText.trim() || "Nothing to show";
//         const author =
//           el.querySelector(".author")?.innerText.trim() || "Unknown";
//         const tags = [...el.querySelectorAll(".tags a")].map((e) =>
//           e.innerText.trim()
//         );

//         titles.push({ quote, author, tags });
//       });

//       return titles;
//     });

//     const grabTitlesObject = await page.evaluate(() => {
//       const quotes = document.querySelectorAll(".col-md-8 .quote span.text");
//       const authors = document.querySelectorAll(
//         ".col-md-8 .quote span .author"
//       );

//       const result = {};

//       quotes.forEach((quoteEl, index) => {
//         const quote = quoteEl.innerText.trim();
//         const author = authors[index]?.innerText.trim() || "Unknown";

//         result[quote] = author;
//       });

//       return result;
//     });

//     console.log(grabTitles, "\n\n");
//     // console.log(grabTitlesObject);
//   } catch (error) {
//     console.log("wrong query selector!!!");
//   } finally {
//     await browser.close();
//   }
// })();
