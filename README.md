# Stock Price Checker

A full-stack microservice that allows users to fetch real-time stock quotes and participate in a privacy-focused "liking" system.

## Features

This project has been refactored from the initial boilerplate to meet professional standards:

- **Security:** Implements Helmet.js and custom CORS whitelisting.
- **Privacy:** Uses salt SHA-256 IP hashing for GDPR/CCPA compliance.
- **Performance:** Executes concurrent API fetching with `Promise.all` for optimized multi-stock comparisons.
- **Architecture:** Uses Express Routers for modular scalability.

> [!TIP]
> For a detailed breakdown of the architectural shifts from "Passing the Test" to "Production Ready," see [REFINE.md](./REFINE.md).

## Technical Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas (via MongoDB Node.js Driver)
- **Security:** Helmet.js (CSP and Header Security), CORS (Access Control)
- **Testing:** Mocha & Chai (Functional and Unit Testing)
- **Utilities:** `node-fetch` (API requests), `crypto` (SHA-256 Hashing), `dotenv` (Environment Management)

## Installation & Setup

1. Run `npm install`.
2. Create a `.env` file with your `DB` (MongoDB URI), `IP_SALT`, and `PORT` (optional, defaults to 3000).
3. Run `npm start` to launch the server.
4. Run `npm test` to execute the functional test suite.
