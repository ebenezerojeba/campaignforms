import PollingUnit from "../models/pollingUnit.js";

/**
 * Zod confirms the nomination payload is well-*formed*; this confirms it's
 * well-*founded* — that the puCode actually exists and its lga/ward/puName
 * match what's on record, not just plausible-looking free text. Matters
 * because the frontend uses cascading selects (so mismatches shouldn't
 * happen from the UI), but a direct API call could still send anything.
 *
 * Returns null if valid, or a user-facing error string if not.
 */
export async function verifyPollingUnit({ lga, ward, puName, puCode }) {
  const record = await PollingUnit.findOne({ puCode: puCode.toUpperCase().trim() }).lean();

  if (!record) {
    return "The selected polling unit code was not recognized.";
  }

  const mismatch =
    record.lga !== lga.toUpperCase().trim() ||
    record.ward !== ward.toUpperCase().trim() ||
    record.puName !== puName.toUpperCase().trim();

  if (mismatch) {
    return "The selected LGA, ward, and polling unit don't match our records.";
  }

  return null;
}