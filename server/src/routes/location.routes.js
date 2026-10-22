import express from "express";
import PollingUnit from "../models/pollingUnit.js";

const router = express.Router();

// Polling-unit reference data rarely changes, so let browsers keep it for an
// hour and Vercel's CDN serve it for a day (refreshing in the background).
// It's public, credential-free data, so any origin may read it — using "*"
// also means one cached copy works for both the form and the admin panel.
router.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  res.set("Access-Control-Allow-Origin", "*");
  res.removeHeader("Access-Control-Allow-Credentials");
  res.removeHeader("Vary");
  next();
});

// Errors must not be cached.
function noStore(res) {
  res.set("Cache-Control", "no-store");
  return res;
}

// Reference data — no auth needed, but still worth a light rate limit
// upstream (mounted under the same general limiter as public routes in
// server.example.js) since it's unauthenticated and DB-backed.

router.get("/lgas", async (req, res) => {
  try {
    const lgas = await PollingUnit.distinct("lga");
    return res.status(200).json({ data: lgas.sort() });
  } catch (error) {
    console.error("Failed to load LGAs:", error);
    return noStore(res).status(500).json({ error: "Failed to load LGA list." });
  }
});

router.get("/wards", async (req, res) => {
  try {
    const { lga } = req.query;
    if (!lga) return noStore(res).status(400).json({ error: "lga query parameter is required." });

    const wards = await PollingUnit.distinct("ward", { lga: lga.toUpperCase().trim() });
    return res.status(200).json({ data: wards.sort() });
  } catch (error) {
    console.error("Failed to load wards:", error);
    return noStore(res).status(500).json({ error: "Failed to load ward list." });
  }
});

router.get("/polling-units", async (req, res) => {
  try {
    const { lga, ward } = req.query;
    if (!lga || !ward) {
      return noStore(res).status(400).json({ error: "lga and ward query parameters are required." });
    }

    const pus = await PollingUnit.find({
      lga: lga.toUpperCase().trim(),
      ward: ward.toUpperCase().trim(),
    })
      .select("puName puCode -_id")
      .sort({ puName: 1 })
      .lean();

    return res.status(200).json({ data: pus });
  } catch (error) {
    console.error("Failed to load polling units:", error);
    return noStore(res).status(500).json({ error: "Failed to load polling unit list." });
  }
});

export default router;