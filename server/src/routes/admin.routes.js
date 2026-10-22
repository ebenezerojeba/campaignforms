import express from "express";
import ExcelJS from "exceljs";
import FormResponse from "../models/formResponse.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { nominationSchema } from "../schemas/nominationSchema.js";
import { adminApiLimiter } from "../middleware/rateLimiter.js";
import { respondIfDuplicateKey } from "../middleware/handleDuplicateKey.js";
import { verifyPollingUnit } from "../utils/verifyPollingUnit.js";
// import { verifyPollingUnit } from "../utils/verifyPollingUnit.js"

const router = express.Router();

// Every route below requires a valid session; export additionally
// requires super_admin (see that route specifically).
router.use(protect, adminApiLimiter);

// --- List / search (staff + super_admin) ----------------------------
router.get("/submissions", requireRole("staff", "super_admin"), async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 15, 100); // cap to prevent abuse
    const skip = (page - 1) * limit;

    // Only accept plain strings from the query — never objects/arrays,
    // which could be used to inject Mongo operators.
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    const search = str(req.query.search).slice(0, 100);
    const lga = str(req.query.lga);
    const ward = str(req.query.ward);
    const source = str(req.query.source);

    const filter = {};
    if (search) {
      // Partial, case-insensitive match on name, or a prefix match on the
      // ID-like fields. Input is escaped so it's matched literally.
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fullName: { $regex: escaped, $options: "i" } },
        { telNo: { $regex: `^${escaped}` } },
        { nin: { $regex: `^${escaped}` } },
        { pvcNumber: { $regex: `^${escaped}`, $options: "i" } },
        { puCode: { $regex: `^${escaped}`, $options: "i" } },
      ];
    }
    if (lga) filter.lga = lga.toUpperCase();
    if (ward) filter.ward = ward.toUpperCase();
    if (source === "public" || source === "admin") filter.source = source;


    const [data, total] = await Promise.all([
      FormResponse.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FormResponse.countDocuments(filter),
    ]);

    return res.status(200).json({ data, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (error) {
    console.error("Admin grid fetch failed:", error);
    return res.status(500).json({ error: "Failed to load submissions." });
  }
});

// --- Manual entry (staff + super_admin) ------------------------------
router.post(
  "/submissions",
  requireRole("staff", "super_admin"),
  validateBody(nominationSchema),
  async (req, res) => {
    try {
      const puError = await verifyPollingUnit(req.body);
      if (puError) {
        return res.status(400).json({ error: puError });
      }

      const record = new FormResponse({
        ...req.body,
        source: "admin",
        createdBy: req.admin._id,
      });
      await record.save();

      return res.status(201).json({ message: "Nominee record created.", id: record._id });
    } catch (error) {
      if (respondIfDuplicateKey(error, res)) return;

      console.error("Manual entry failed:", error);
      return res.status(400).json({ error: "Could not create record — check the submitted fields." });
    }
  }
);

// --- Edit an existing record (staff + super_admin) -------------------
router.patch(
  "/submissions/:id",
  requireRole("staff", "super_admin"),
  validateBody(nominationSchema),
  async (req, res) => {
    try {
      const puError = await verifyPollingUnit(req.body);
      if (puError) {
        return res.status(400).json({ error: puError });
      }

      const updated = await FormResponse.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.admin._id },
        { returnDocument: "after", runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Record not found." });
      }
      return res.status(200).json({ message: "Record updated.", data: updated });
    } catch (error) {
      if (respondIfDuplicateKey(error, res)) return;

      console.error("Record update failed:", error);
      return res.status(400).json({ error: "Could not update record." });
    }
  }
);

// --- Bulk export (super_admin ONLY) -----------------------------------
// This is the highest-risk action in the system — it lets one request
// walk out the door with every nominee's NIN, PVC number, and bank
// details. Gate it tighter than read/write access to individual records.
router.get("/export", requireRole("super_admin"), async (req, res) => {
  const { format } = req.query;

  try {
    const cursor = FormResponse.find({}).sort({ createdAt: -1 }).lean().cursor();

    if (format === "excel") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=PUC_Master_Nomination_Report.xlsx");

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const worksheet = workbook.addWorksheet("All Nominees");

      worksheet.columns = [
        { header: "Full Name", key: "fullName", width: 25 },
        { header: "Address", key: "address", width: 30 },
        { header: "Tel No", key: "telNo", width: 15 },
        { header: "Email", key: "email", width: 25 },
        { header: "Sex", key: "sex", width: 8 },
        { header: "Date of Birth", key: "dateOfBirth", width: 15 },
        { header: "Marital Status", key: "maritalStatus", width: 15 },
        { header: "LGA", key: "lga", width: 15 },
        { header: "Ward", key: "ward", width: 20 },
        { header: "PU Name", key: "puName", width: 30 },
        { header: "PU Code", key: "puCode", width: 15 },
        { header: "PVC Number", key: "pvcNumber", width: 20 },
        { header: "NIN", key: "nin", width: 15 },
        { header: "Bank Name", key: "bankName", width: 20 },
        { header: "Account No", key: "accountNo", width: 15 },
        { header: "Account Name", key: "accountName", width: 25 },
        { header: "Source", key: "source", width: 10 },
        { header: "Submission Date", key: "createdAt", width: 20 },
      ];

      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        worksheet
          .addRow({
            fullName: doc.fullName,
            address: doc.address,
            telNo: doc.telNo,
            email: doc.email || "",
            sex: doc.sex,
            dateOfBirth: doc.dateOfBirth,
            maritalStatus: doc.maritalStatus,
            lga: doc.lga,
            ward: doc.ward,
            puName: doc.puName,
            puCode: doc.puCode,
            pvcNumber: doc.pvcNumber,
            nin: doc.nin,
            bankName: doc.bankDetails?.bankName || "",
            accountNo: doc.bankDetails?.accountNo || "",
            accountName: doc.bankDetails?.accountName || "",
            source: doc.source,
            createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
          })
          .commit();
      }

      return await workbook.commit();
    }

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=puc_backup.json");

      res.write("[\n");
      let isFirst = true;
      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        if (!isFirst) res.write(",\n");
        res.write(JSON.stringify(doc));
        isFirst = false;
      }
      res.write("\n]");
      return res.end();
    }

    return res.status(400).json({ error: "Invalid format chosen." });
  } catch (error) {
    console.error("Streaming pipeline failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Streaming pipeline failed." });
    }
  }
});


router.get("/stats/overview", requireRole("staff", "super_admin"), async (req, res) => {
  try {
    const [byLga, bySourceRaw] = await Promise.all([
      FormResponse.aggregate([
        { $group: { _id: "$lga", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, lga: "$_id", count: 1 } },
      ]),
      FormResponse.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
    ]);

    const total = byLga.reduce((sum, r) => sum + r.count, 0);
    const bySource = Object.fromEntries(bySourceRaw.map((r) => [r._id, r.count]));

    return res.status(200).json({ total, lgaCount: byLga.length, byLga, bySource });
  } catch (error) {
    console.error("Stats aggregation failed:", error);
    return res.status(500).json({ error: "Failed to compute stats." });
  }
});

export default router;