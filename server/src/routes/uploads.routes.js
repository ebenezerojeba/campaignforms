import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { adminApiLimiter, publicFormLimiter } from "../middleware/rateLimiter.js";
// Reuse the same limiter config used elsewhere for public-facing write
// endpoints — separate name here since this isn't an admin route, but
// swap in whatever your project's public-endpoint limiter is called.
// import { publicApiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Public nominees hit this before uploading their photo — no auth
// required (this isn't the admin dashboard), but rate-limited since
// it's an unauthenticated endpoint anyone can call.
router.get("/photo-signature", publicFormLimiter, (req, res) => {
  if (!process.env.CLOUDINARY_API_SECRET) {
    console.error("CLOUDINARY_API_SECRET is not configured.");
    return res.status(500).json({ error: "Photo upload is not available right now." });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "puc-nominee-photos";

  // Only params included here are signed — the client cannot alter
  // `folder` or add other params without invalidating the signature,
  // which keeps uploads confined to this one Cloudinary folder.
  const paramsToSign = { timestamp, folder };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return res.status(200).json({
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});

export default router;