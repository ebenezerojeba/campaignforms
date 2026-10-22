import rateLimit from "express-rate-limit";

// Public nomination intake: generous enough for a legit person retrying
// after a validation error, tight enough to blunt scripted spam.
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // a submission uses 2 requests (photo signature + form)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions from this network. Please try again later." },
});

// Login: brute-force protection. Deliberately stricter.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

// General admin API traffic — mostly a safety net against a runaway
// frontend loop, not meant to be restrictive for normal use.
export const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});