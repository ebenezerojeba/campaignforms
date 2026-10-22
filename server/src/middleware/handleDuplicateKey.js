/**
 * MongoDB duplicate-key errors (E11000) come back as a generic driver
 * error, not a validation error — Express won't format it nicely on its
 * own. This inspects the error and, if it's a dup-key violation on a
 * field we recognize, returns a specific 409 message. Otherwise it
 * re-throws for the route's own catch block to handle generically.
 */
const FIELD_LABELS = {
  nin: "This NIN is already registered.",
  pvcNumber: "This PVC number is already registered.",
  username: "That username is already taken.",
};

export function respondIfDuplicateKey(err, res) {
  if (err?.code !== 11000) return false;

  const field = Object.keys(err.keyPattern || {})[0];
  const message = FIELD_LABELS[field] || "A record with this value already exists.";

  res.status(409).json({ error: message, field });
  return true;
}