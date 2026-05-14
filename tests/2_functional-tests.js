const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");

chai.use(chaiHttp);

suite("Functional Tests", function () {
  suite("GET /api/stock-prices => stockData object", function () {
    test("Viewing one stock", function (done) {
      chai
        .request(server)
        .get("/api/stock-prices")
        .query({ stock: "GOOG" })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, "stockData");
          assert.property(res.body.stockData, "stock");
          assert.property(res.body.stockData, "price");
          assert.property(res.body.stockData, "likes");
          assert.equal(res.body.stockData.stock, "GOOG");
          assert.isNumber(res.body.stockData.price);
          assert.isNumber(res.body.stockData.likes);
          done();
        });
    });

    test("Viewing one stock and liking it", function (done) {
      chai
        .request(server)
        .get("/api/stock-prices")
        .query({ stock: "AAPL", like: true })
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.property(res.body, "stockData");
          assert.equal(res.body.stockData.stock, "AAPL");
          assert.isNumber(res.body.stockData.likes);
          // verify like increment is persisted
          assert.isAtLeast(res.body.stockData.likes, 1);
          done();
        });
    });

    test("Viewing the same stock and liking it again", function (done) {
      chai
        .request(server)
        .get("/api/stock-prices")
        .query({ stock: "AAPL", like: true })
        .end(function (err, res1) {
          assert.equal(res1.status, 200);
          assert.property(res1.body, "stockData");
          assert.equal(res1.body.stockData.stock, "AAPL");
          assert.isNumber(res1.body.stockData.likes);

          const initialLikes = res1.body.stockData.likes;

          chai
            .request(server)
            .get("/api/stock-prices")
            .query({ stock: "AAPL", like: true })
            .end(function (err, res2) {
              assert.equal(res2.status, 200);
              assert.property(res2.body, "stockData");
              assert.equal(res2.body.stockData.stock, "AAPL");
              assert.isNumber(res2.body.stockData.likes);
              // ensure repeated likes from the same client are ignored
              assert.equal(res2.body.stockData.likes, initialLikes);
              done();
            });
        });
    });

    test("Viewing two stocks", function (done) {
      chai
        .request(server)
        .get("/api/stock-prices")
        .query({ stock: ["GOOG", "MSFT"] })
        .end(function (err, res1) {
          assert.equal(res1.status, 200);
          assert.isArray(res1.body.stockData);
          assert.equal(res1.body.stockData.length, 2);

          // relative likes between two stocks should sum to zero
          const relLikesSum1 =
            res1.body.stockData[0].rel_likes + res1.body.stockData[1].rel_likes;
          assert.equal(relLikesSum1, 0);

          chai
            .request(server)
            .get("/api/stock-prices")
            .query({ stock: ["GOOG", "MSFT"] })
            .end(function (err, res2) {
              assert.equal(res2.status, 200);
              assert.isArray(res2.body.stockData);
              assert.equal(res2.body.stockData.length, 2);

              const relLikesSum2 =
                res2.body.stockData[0].rel_likes +
                res2.body.stockData[1].rel_likes;
              assert.equal(relLikesSum2, 0);

              // validate consistency of relative data across multiple calls
              assert.deepEqual(
                res1.body.stockData.map((s) => s.rel_likes),
                res2.body.stockData.map((s) => s.rel_likes),
              );
              done();
            });
        });
    });

    test("Viewing two stocks and liking them", function (done) {
      chai
        .request(server)
        .get("/api/stock-prices")
        .query({ stock: ["GOOG", "MSFT"], like: true })
        .end(function (err, res1) {
          assert.equal(res1.status, 200);
          assert.isArray(res1.body.stockData);
          assert.equal(res1.body.stockData.length, 2);

          const relLikesSum1 =
            res1.body.stockData[0].rel_likes + res1.body.stockData[1].rel_likes;
          assert.equal(relLikesSum1, 0);

          chai
            .request(server)
            .get("/api/stock-prices")
            .query({ stock: ["GOOG", "MSFT"], like: true })
            .end(function (err, res2) {
              assert.equal(res2.status, 200);
              assert.isArray(res2.body.stockData);
              assert.equal(res2.body.stockData.length, 2);

              const relLikesSum2 =
                res2.body.stockData[0].rel_likes +
                res2.body.stockData[1].rel_likes;
              assert.equal(relLikesSum2, 0);

              // confirm that liking both stocks simultaneously maintains the relative difference
              assert.deepEqual(
                res1.body.stockData.map((s) => s.rel_likes),
                res2.body.stockData.map((s) => s.rel_likes),
              );
              done();
            });
        });
    });
  });
});
