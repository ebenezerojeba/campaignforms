/**
 * Usage: node scripts/seedLocations.js
 * Requires MONGODB_URI in the environment. Safe to re-run — it upserts
 * on the unique `puCode`, so it won't create duplicates if you run it
 * again after fixing a typo in the source spreadsheet.
 */
import dns from "node:dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PollingUnit from "../models/PollingUnit.js";

dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set in the environment.");
    process.exit(1);
  }

  const dataPath = path.join(__dirname, "..", "data", "lga_ward_pu.json");
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  await mongoose.connect(process.env.MONGODB_URI);

  let upserted = 0;
  let failed = 0;
  const bulkOps = [];

  for (const [lga, wards] of Object.entries(raw)) {
    for (const [ward, pus] of Object.entries(wards)) {
      for (const pu of pus) {
        bulkOps.push({
          updateOne: {
            filter: { puCode: pu.puCode.toUpperCase().trim() },
            update: {
              $set: {
                lga: lga.toUpperCase().trim(),
                ward: ward.toUpperCase().trim(),
                puName: pu.puName.toUpperCase().trim(),
                puCode: pu.puCode.toUpperCase().trim(),
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  console.log(`Prepared ${bulkOps.length} polling unit records. Writing in batches…`);

  // MongoDB caps bulkWrite batch size in practice — chunk to be safe
  // (13k+ records is well within a single driver call, but this keeps
  // memory/network use predictable if the dataset grows to cover more
  // states later).
  const BATCH_SIZE = 1000;
  for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
    const batch = bulkOps.slice(i, i + BATCH_SIZE);
    try {
      const result = await PollingUnit.bulkWrite(batch, { ordered: false });
      upserted += result.upsertedCount + result.modifiedCount;
    } catch (err) {
      failed += batch.length;
      console.error(`Batch ${i / BATCH_SIZE + 1} had errors:`, err.message);
    }
  }

  const total = await PollingUnit.countDocuments();
  console.log(`Done. ${upserted} records written this run. Collection now has ${total} polling units.`);
  if (failed > 0) console.warn(`${failed} records failed — check for duplicate/malformed puCode values above.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});