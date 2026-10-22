import express from "express";
import ExcelJS from "exceljs";
import FormResponse from "../models/formResponse.js";

const router = express.Router();

// Public form intake route
router.post("/responses", async (req, res) => {
  try {
    const newResponse = new FormResponse(req.body);
    await newResponse.save();

    return res.status(201).json({
      message: "Nomination submitted successfully!",
      id: newResponse._id,
    });
  } catch (error) {
    console.error("Data ingestion breakdown:", error);

    return res.status(400).json({
      error: "Validation failed or incomplete fields matching the PUC Form.",
    });
  }
});

// Admin paginated grid lookup
router.get("/admin/submissions", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      FormResponse.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FormResponse.countDocuments({}),
    ]);

    return res.status(200).json({
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to stream admin grid data.",
    });
  }
});

// Low-memory multi-format export stream
router.get("/admin/export", async (req, res) => {
  const { format } = req.query;

  try {
    const cursor = FormResponse.find({})
      .sort({ createdAt: -1 })
      .lean()
      .cursor();

    if (format === "excel") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=PUC_Master_Nomination_Report.xlsx"
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
      });

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
        { header: "Submission Date", key: "createdAt", width: 20 },
      ];

      for (
        let doc = await cursor.next();
        doc != null;
        doc = await cursor.next()
      ) {
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
            createdAt: doc.createdAt
              ? doc.createdAt.toISOString()
              : "",
          })
          .commit();
      }

      return await workbook.commit();
    }

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=puc_backup.json"
      );

      res.write("[\n");
      let isFirst = true;

      for (
        let doc = await cursor.next();
        doc != null;
        doc = await cursor.next()
      ) {
        if (!isFirst) {
          res.write(",\n");
        }

        res.write(JSON.stringify(doc));
        isFirst = false;
      }

      res.write("\n]");
      return res.end();
    }

    return res.status(400).json({
      error: "Invalid format chosen.",
    });
  } catch (error) {
    console.error("Streaming pipeline failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Streaming pipeline failed.",
      });
    }
  }
});

export default router;