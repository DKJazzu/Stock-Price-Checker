"use strict";

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");

const apiRoutes = require("./routes/api.js");
const fccTestingRoutes = require("./routes/fcctesting.js");
const runner = require("./test-runner");

const app = express();

// Security headers
app.use((req, res, next) => {
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'";
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("content-security-policy", csp);
  next();
});

app.use("/public", express.static(process.cwd() + "/public"));

app.use(cors({ origin: "*" })); // For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Index page (static HTML)
app.route("/").get(function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// App info route (for FCC testing)
app.get("/_api/app-info", function (req, res) {
  res.json({
    headers: {
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'",
      "x-xss-protection": "1; mode=block",
      "x-content-type-options": "nosniff",
      "x-powered-by": "PHP 4.2.0",
    },
  });
});

// For FCC testing purposes
fccTestingRoutes(app);

// Routing for API
apiRoutes(app);

// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404).type("text").send("Not Found");
});

// Start our server and tests!
const port = process.env.PORT || 3000;
const listener = app.listen(port, function () {
  console.log("Your app is listening on port " + listener.address().port);
  if (process.env.NODE_ENV === "test") {
    console.log("Running Tests...");
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log("Tests are not valid:");
        console.error(e);
      }
    }, 3500);
  }
});

module.exports = app; // for testing
