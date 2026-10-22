import mongoose from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

const AdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["staff", "super_admin"],
      default: "staff",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

AdminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

AdminSchema.statics.hashPassword = function (plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

const Admin =
  mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

export default Admin;