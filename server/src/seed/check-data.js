// Run from your backend project root: node cleanup-null-source.js
// Step 1 (default): DRY RUN — just prints what would be deleted.
// Step 2: pass --delete to actually remove them.
import dns from "node:dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import FormResponse from "../models/formResponse.js";
// import FormResponse from "./models/formResponse.js"adjust path if needed

dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));

const shouldDelete = process.argv.includes("--delete");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI); // match your actual env var name

  const candidates = await FormResponse.find(
    { $or: [{ source: null }, { source: { $exists: false } }] },
    { fullName: 1, source: 1, lga: 1, createdAt: 1 }
  ).lean();

  console.log(`Found ${candidates.length} record(s) with missing source:\n`);
  console.table(candidates);

  if (!shouldDelete) {
    console.log("\nDry run only — nothing deleted. Re-run with --delete to remove these.");
  } else {
    const ids = candidates.map((r) => r._id);
    const result = await FormResponse.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} record(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});