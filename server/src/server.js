// Load .env before anything else imports and reads process.env.
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./routes/auth.routes.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import locationRoutes from "./routes/location.routes.js";
import uploadRoutes from "./routes/uploads.routes.js";

// Optional: some networks (e.g. phone hotspots) return DNS answers Node
// can't parse, which breaks mongodb+srv:// URIs. Set DNS_SERVERS in .env
// (e.g. "8.8.8.8,1.1.1.1") to use public DNS instead. Leave unset in production.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
}

const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

// --- Database --------------------------------------------------------------
// Connect once and reuse. On Vercel each warm function instance keeps this
// connection between requests; the promise stops parallel cold-start
// requests from opening several connections.
let dbPromise = null;
function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!dbPromise) {
    dbPromise = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      .then(() => console.log("MongoDB connected"))
      .catch((err) => {
        dbPromise = null; // allow the next request to retry
        throw err;
      });
  }
  return dbPromise;
}

const app = express();

// Behind Vercel's proxy: use the real client IP (for rate limiting), not the proxy's.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// --- Security middleware ---------------------------------------------------
app.use(helmet());

// CLIENT_ORIGIN is a comma-separated list of the exact frontend origins
// allowed to call this API (public form + admin panel).
const allowedOrigins = new Set(
  process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
);
if (!isProduction) {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://localhost:5174");
}

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin, curl, or server-to-server.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false); // browser blocks it; no 500 in the logs
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" })); // nomination payloads are small

// --- Health check (no DB needed) -------------------------------------------
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// Every other route needs the database.
app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
});

// --- Routes ----------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes); // POST /api/responses
app.use("/api/admin", adminRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/uploads", uploadRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// --- Fallback error handler ------------------------------------------------
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: "Something went wrong." });
});

// Vercel imports the app and handles listening itself; locally we listen.
if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  connectDb()
    .then(() => {
      app.listen(port, () => console.log(`PUC server listening on port ${port}`));
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    });
}

export default app;
