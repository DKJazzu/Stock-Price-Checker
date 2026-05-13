"use strict";

const fetch = require("node-fetch");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const CONNECTION_STRING = process.env.DB;
const IP_SALT = process.env.IP_SALT || "default_salt_string";
// regex for valid stock symbols (letters only, uppercase)
const STOCK_REGEX = /^[A-Z]+$/;

module.exports = function (app) {
  const client = new MongoClient(CONNECTION_STRING);
  const dbPromise = client.connect().then((mClient) => mClient.db());

  app.route("/api/stock-prices").get(async function (req, res) {
    try {
      const db = await dbPromise;
      const collection = db.collection("stocks");

      let { stock, like } = req.query;
      if (!stock) return res.json({ error: "stock query required" });

      // normalize stock input to an array to handle single or multiple comparisons
      let stocks = Array.isArray(stock) ? stock : [stock];
      let results = [];

      for (let s of stocks) {
        let symbol = s.toUpperCase();

        // validate symbol before hitting API
        if (!STOCK_REGEX.test(symbol)) {
          results.push({
            stock: symbol,
            price: 0,
            likes: 0,
            error: "invalid symbol",
          });
          continue;
        }

        let priceData;
        try {
          const r = await fetch(
            `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`,
          );
          if (!r.ok) throw new Error(`Bad response ${r.status}`);
          priceData = await r.json();
        } catch (err) {
          console.error(`Fetch error for ${symbol}:`, err);
          results.push({ stock: symbol, price: 0, likes: 0 });
          continue;
        }

        if (!priceData || !priceData.latestPrice) {
          results.push({ stock: symbol, price: 0, likes: 0 });
          continue;
        }

        // extract client IP even behind proxies/load balancers
        const ip =
          (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          req.socket.remoteAddress ||
          req.ip;

        // salted SHA-256 hashing for IP anonymity
        const hashedIp = crypto
          .createHash("sha256")
          .update(ip + IP_SALT)
          .digest("hex");

        const isLiked = req.query.like === "true";

        let update = { $setOnInsert: { stock: symbol } };
        if (isLiked) {
          update.$addToSet = { likes: hashedIp }; // ensures unique likes per IP without duplicates
        } else {
          update.$addToSet = { likes: { $each: [] } }; // ensure field exists without modifying existing likes
        }

        const doc = await collection.findOneAndUpdate(
          { stock: symbol },
          update,
          { upsert: true, returnDocument: "after" },
        );

        // handle MongoDB driver version differences for return value
        const updatedDoc = doc.value || doc;
        const likesArr = updatedDoc.likes || [];

        results.push({
          stock: symbol,
          price: parseFloat(priceData.latestPrice) || 0,
          likes: likesArr.length,
        });
      }

      if (results.length === 1) {
        res.json({ stockData: results[0] });
      } else {
        // calculate relative likes for exactly two stocks
        const [first, second] = results;
        res.json({
          stockData: [
            {
              stock: first.stock,
              price: first.price,
              rel_likes: first.likes - second.likes,
            },
            {
              stock: second.stock,
              price: second.price,
              rel_likes: second.likes - first.likes,
            },
          ],
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  });
};
