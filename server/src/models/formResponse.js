import mongoose from "mongoose";

const BankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    accountNo: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const FormResponseSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    telNo: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    sex: { type: String, enum: ["M", "F"], required: true },
    dateOfBirth: { type: String, required: true },
    photoUrl: { type: String, required: true },
    photoPublicId: { type: String },
    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Divorced", "Widowed"],
      required: true,
    },

    // Geographical mapping
    lga: { type: String, required: true, uppercase: true, trim: true },
    ward: { type: String, required: true, uppercase: true, trim: true },
    puName: { type: String, required: true, uppercase: true, trim: true },
    puCode: { type: String, required: true, uppercase: true, trim: true },

    // Identifiers — these are the two fields that must be globally unique.
    // `unique: true` on a schema path creates a unique index in MongoDB;
    // without it (as in the original schema) duplicate NIN/PVC submissions
    // silently succeed.
    pvcNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    nin: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    bankDetails: { type: BankDetailsSchema, required: true },

    // --- Audit trail --------------------------------------------------
    // Distinguishes a self-service public submission from one keyed in
    // by staff, and (for admin entries) who entered/last touched it.
    source: {
      type: String,
      enum: ["public", "admin"],
      default: "public",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null, // null for public self-submissions
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

// Query-pattern indexes (list/filter/export at 13k+ rows)
FormResponseSchema.index({ lga: 1, ward: 1 });
FormResponseSchema.index({ createdAt: -1 });
// Lightweight text index so the admin dashboard can search by name without
// a full collection scan.
FormResponseSchema.index({ fullName: "text" });

const FormResponse = mongoose.models.FormResponse || mongoose.model("FormResponse", FormResponseSchema);

export default FormResponse;