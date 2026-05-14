"use strict";

const express = require("express");
const { MongoClient } = require("mongodb");
const crypto = require("crypto");
const fetch = require("node-fetch");

const CONNECTION_STRING = process.env.DB;
const IP_SALT = process.env.IP_SALT || "default_salt_string";
// regex for valid stock symbols
const STOCK_REGEX = /^[A-Z]+$/;

const router = express.Router();

const client = new MongoClient(CONNECTION_STRING);
const dbPromise = client.connect().then((mClient) => mClient.db());

// gracefully close database connection on process termination
process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});

router.get("/stock-prices", async (req, res) => {
  try {
    const db = await dbPromise;
    const collection = db.collection("stocks");

    let { stock, like } = req.query;
    if (!stock) return res.json({ error: "stock query required" });

    // normalize input to handle both single strings and arrays of stock symbols
    const stocks = Array.isArray(stock) ? stock : [stock];
    const isLiked = like === "true";

    const results = await Promise.all(
      stocks.map(async (s) => {
        const symbol = s.toUpperCase();

        if (!STOCK_REGEX.test(symbol)) {
          return { stock: symbol, price: 0, likes: 0, error: "invalid symbol" };
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
          return { stock: symbol, price: 0, likes: 0, error: "fetch failed" };
        }

        if (!priceData || !priceData.latestPrice) {
          return { stock: symbol, price: 0, likes: 0, error: "no price data" };
        }

        // salted SHA-256 hashing for IP anonymity
        const ip = req.ip;
        const hashedIp = crypto
          .createHash("sha256")
          .update(ip + IP_SALT)
          .digest("hex");

        let update = { $setOnInsert: { stock: symbol, likes: [] } };
        if (isLiked) {
          update.$addToSet = { likes: hashedIp }; // ensures unique likes per hashed IP address
        }

        const doc = await collection.findOneAndUpdate(
          { stock: symbol },
          update,
          { upsert: true, returnDocument: "after" },
        );

        // standardize document access across different MongoDB driver versions
        const updatedDoc = doc.value || doc;
        const likesArr = updatedDoc.likes || [];

        return {
          stock: symbol,
          price: parseFloat(priceData.latestPrice) || 0,
          likes: likesArr.length,
        };
      }),
    );

    if (results.length === 1) {
      res.json({ stockData: results[0] });
    } else if (results.length === 2) {
      const [first, second] = results;
      // calculate relative likes for comparison when two stocks are requested
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
    } else {
      res.json({ stockData: results });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

module.exports = router;
