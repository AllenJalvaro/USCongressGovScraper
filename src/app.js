const express = require("express");
const scrapeRoutes = require("./routes/scrapeRoutes");

const app = express();
app.use(express.json());

app.use("/api", scrapeRoutes);

module.exports = app;
