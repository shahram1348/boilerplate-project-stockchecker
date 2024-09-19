"use strict";

const https = require("https");

const crypto = require("crypto");

function anonymizeIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}
module.exports = function (app) {
  const likes = new Map();

  app.route("/api/stock-prices").get(async function (req, res) {
    const anonymizeIp = anonymizeIp(req.ip);

    const { stock, like } = req.query;
    try {
      if (Array.isArray(stock)) {
        // Handle multiple stocks
        const results = await Promise.all(
          stock.map((s) => getStockData(s, like === "true", anonymizeIp))
        );
        const [stock1, stock2] = results;
        const rel_likes1 = stock1.likes - stock2.likes;
        const rel_likes2 = stock2.likes - stock1.likes;
        res.json({
          stockData: [
            { stock: stock1.stock, price: stock1.price, rel_likes: rel_likes1 },
            { stock: stock2.stock, price: stock2.price, rel_likes: rel_likes2 },
          ],
        });
      } else {
        // Handle single stock
        const result = await getStockData(stock, like === "true", anonymizeIp);
        res.json({ stockData: result });
      }
    } catch (error) {
      res.status(500).json({ error: "An error occurred" });
    }
  });

  async function getStockData(stock, like, ip) {
    return new Promise((resolve, reject) => {
      https
        .get(
          `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`,
          (response) => {
            let data = "";

            response.on("data", (chunk) => {
              data += chunk;
            });

            response.on("end", () => {
              const stockData = JSON.parse(data);

              const key = stock.toUpperCase();
              if (!likes.has(key)) {
                likes.set(key, new Set());
              }
              if (like && !likes.get(key).has(ip)) {
                likes.get(key).add(ip);
              }
              const likeCount = likes.get(key).size;

              resolve({
                stock: stockData.symbol,
                price: stockData.latestPrice,
                likes: likeCount,
              });
            });
          }
        )
        .on("error", (error) => {
          reject(error);
        });
    });
  }
};
