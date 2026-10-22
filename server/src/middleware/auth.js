import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";
// import Admin from "../models/Admin.js";

/**
 * Verifies the Bearer token on the request, loads the admin record, and
 * attaches it to req.admin. Any route behind this middleware is guaranteed
 * to have an authenticated, active admin by the time the handler runs.
 */
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing or malformed authorization header." });
    }

    if (!process.env.JWT_SECRET) {
      // Fail loudly in dev rather than silently accepting unsigned tokens
      throw new Error("JWT_SECRET is not configured.");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(payload.sub);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: "Account not found or deactivated." });
    }

    req.admin = admin; // { _id, username, role, ... } (no passwordHash — not selected)
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid session token." });
    }
    console.error("Auth middleware failure:", err);
    return res.status(500).json({ error: "Authentication check failed." });
  }
}

/**
 * Role gate — use after `protect`. Usage: requireRole('super_admin')
 * or requireRole('staff', 'super_admin').
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      // Defensive — should never happen if `protect` ran first
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    return next();
  };
}