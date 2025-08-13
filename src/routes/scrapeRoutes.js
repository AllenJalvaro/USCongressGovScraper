const express = require("express");
const router = express.Router();
const { scrapeCongressData } = require("../api/scrapeUSCongressGovController");

router.get("/scrape", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    const data = await scrapeCongressData(targetUrl);
    res.json(data);
  } catch (error) {
    console.error("Scraping failed:", error);
    res.status(500).json({ error: "Scraping failed", details: error.message });
  }
});

module.exports = router;
