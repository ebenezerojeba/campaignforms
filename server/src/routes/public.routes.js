import express from "express";
// import FormResponse from "../models/FormResponse.js";
import { validateBody } from "../middleware/validate.js";
import { nominationSchema } from "../schemas/nominationSchema.js";
import { publicFormLimiter } from "../middleware/rateLimiter.js";
import { respondIfDuplicateKey } from "../middleware/handleDuplicateKey.js";
import { verifyPollingUnit } from "../utils/verifyPollingUnit.js";
import FormResponse from "../models/formResponse.js";



const router = express.Router();

router.post("/responses", publicFormLimiter, validateBody(nominationSchema), async (req, res) => {
  try {
    const puError = await verifyPollingUnit(req.body);
    if (puError) {
      return res.status(400).json({ error: puError });
    }

    const newResponse = new FormResponse({
      ...req.body,
      source: "public", // never trust a client-supplied value for this
    });
    await newResponse.save();

    return res.status(201).json({
      message: "Nomination submitted successfully!",
      id: newResponse._id,
    });
  } catch (error) {
    if (respondIfDuplicateKey(error, res)) return;

    console.error("Data ingestion breakdown:", error);
    return res.status(400).json({
      error: "Validation failed or incomplete fields matching the PUC Form.",
    });
  }
});

export default router;