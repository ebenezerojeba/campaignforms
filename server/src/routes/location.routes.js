import express from "express";
import PollingUnit from "../models/pollingUnit.js";

const router = express.Router();

// Reference data — no auth needed, but still worth a light rate limit
// upstream (mounted under the same general limiter as public routes in
// server.example.js) since it's unauthenticated and DB-backed.

router.get("/lgas", async (req, res) => {
  try {
    const lgas = await PollingUnit.distinct("lga");
    return res.status(200).json({ data: lgas.sort() });
  } catch (error) {
    console.error("Failed to load LGAs:", error);
    return res.status(500).json({ error: "Failed to load LGA list." });
  }
});

router.get("/wards", async (req, res) => {
  try {
    const { lga } = req.query;
    if (!lga) return res.status(400).json({ error: "lga query parameter is required." });

    const wards = await PollingUnit.distinct("ward", { lga: lga.toUpperCase().trim() });
    return res.status(200).json({ data: wards.sort() });
  } catch (error) {
    console.error("Failed to load wards:", error);
    return res.status(500).json({ error: "Failed to load ward list." });
  }
});

router.get("/polling-units", async (req, res) => {
  try {
    const { lga, ward } = req.query;
    if (!lga || !ward) {
      return res.status(400).json({ error: "lga and ward query parameters are required." });
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
    return res.status(500).json({ error: "Failed to load polling unit list." });
  }
});

export default router;