import { z } from "zod";

// NIN: Nigeria's National Identification Number is 11 digits.
const ninRegex = /^\d{11}$/;
// Nigerian bank account numbers (NUBAN) are 10 digits.
const accountNoRegex = /^\d{10}$/;
// Loose but useful phone check — accepts 11-digit local format or +234 prefix.
const phoneRegex = /^(\+234|0)\d{9,10}$/;

const bankDetailsSchema = z.object({
  bankName: z.string().trim().min(2, "Bank name is required.").max(60),
  accountNo: z
    .string()
    .trim()
    .regex(accountNoRegex, "Account number must be exactly 10 digits."),
  accountName: z.string().trim().min(2, "Account name is required.").max(100),
});

/**
 * Core nomination payload — shared by the public intake route and the
 * admin manual-entry route. `.strict()` rejects any field not listed here,
 * which is what stops a client from smuggling in `source`, `createdBy`,
 * or other server-controlled fields.
 */
export const nominationSchema = z
  .object({
    fullName: z.string().trim().min(3, "Full name is required.").max(120),
    address: z.string().trim().min(5, "Address is required.").max(240),
    telNo: z
      .string()
      .trim()
      .regex(phoneRegex, "Enter a valid Nigerian phone number."),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    sex: z.enum(["M", "F"], {
      errorMap: () => ({ message: "Select a valid sex." }),
    }),
    dateOfBirth: z
      .string()
      .refine(
        (val) => !Number.isNaN(Date.parse(val)),
        "Enter a valid date of birth.",
      )
      .refine((val) => {
        const age =
          (Date.now() - Date.parse(val)) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 18;
      }, "Nominee must be at least 18 years old."),
    maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"]),

    lga: z.string().trim().min(2).max(60),
    ward: z.string().trim().min(2).max(80),
    puName: z.string().trim().min(2).max(120),
    puCode: z.string().trim().min(3).max(30),

    photoUrl: z.string().url(),
    photoPublicId: z.string().optional(), // Cloudinary public_id — used later if you ever need to delete/replace the image; not required from the client
    pvcNumber: z.string().trim().min(6, "Enter a valid PVC number.").max(40),

    nin: z.string().trim().regex(ninRegex, "NIN must be exactly 11 digits."),

    bankDetails: bankDetailsSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    username: z.string().trim().min(3).max(32),
    password: z.string().min(8).max(128),
  })
  .strict();
