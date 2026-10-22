import express from "express";
import jwt from "jsonwebtoken";
// import Admin from "../models/Admin.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../schemas/nominationSchema.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { protect } from "../middleware/auth.js";
import Admin from "../models/admin.js";

const router = express.Router();

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    // .select("+passwordHash") because the schema excludes it by default
    const admin = await Admin.findOne({ username }).select("+passwordHash");

    // Deliberately identical error for "no such user" and "wrong password"
    // so the response can't be used to enumerate valid usernames.
    const invalidCredsResponse = () =>
      res.status(401).json({ error: "Invalid username or password." });

    if (!admin || !admin.isActive) return invalidCredsResponse();

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return invalidCredsResponse();

    const token = jwt.sign(
      { sub: admin._id.toString(), role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    admin.lastLoginAt = new Date();
    await admin.save();

    return res.status(200).json({
      token,
      admin: { id: admin._id, username: admin.username, role: admin.role },
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// Lets the frontend verify a stored token / rehydrate the session on load
router.get("/me", protect, (req, res) => {
  res.status(200).json({
    admin: { id: req.admin._id, username: req.admin.username, role: req.admin.role },
  });
});

export default router;