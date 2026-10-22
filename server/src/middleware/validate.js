/**
 * Wraps a Zod schema as Express middleware. On success, req.body is
 * replaced with the *parsed* (and thus type-coerced/trimmed) data — so
 * downstream handlers never touch raw, unvalidated input.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed.",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.body = result.data;
    return next();
  };
}