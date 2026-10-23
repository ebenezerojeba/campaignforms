/**
 * Usage:
 *   node scripts/createAdmin.js <username> <password> <role>
 *   node scripts/createAdmin.js ebenezer "StrongP@ssw0rd!" super_admin
 *
 * role defaults to "staff" if omitted.
 * Requires MONGODB_URI in the environment (same as the main server).
 */
import dns from "node:dns";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";

dotenv.config();
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));

async function main() {
  const [, , username, password, role = "staff"] = process.argv;

  if (!username || !password) {
    console.error("Usage: node scripts/createAdmin.js <username> <password> [role]");
    process.exit(1);
  }
  if (!["staff", "super_admin"].includes(role)) {
    console.error('Role must be "staff" or "super_admin".');
    process.exit(1);
  }
  if (password.length < 7) {
    console.error("Password must be at least 7 characters.");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set in the environment.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await Admin.findOne({ username: username.toLowerCase() });
  if (existing) {
    console.error(`Username "${username}" already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await Admin.hashPassword(password);
  const admin = await Admin.create({ username, passwordHash, role });

  console.log(`Created ${admin.role} account "${admin.username}" (id: ${admin._id}).`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});