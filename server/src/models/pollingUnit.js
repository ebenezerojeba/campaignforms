import mongoose from "mongoose";

const PollingUnitSchema = new mongoose.Schema(
  {
    lga: { type: String, required: true, uppercase: true, trim: true },
    ward: { type: String, required: true, uppercase: true, trim: true },
    puName: { type: String, required: true, uppercase: true, trim: true },
    puCode: { type: String, required: true, uppercase: true, trim: true, unique: true },
  },
  { timestamps: true }
);

// Powers the cascading LGA -> Ward -> PU dropdowns and the PU-code
// integrity check on nomination submit.
PollingUnitSchema.index({ lga: 1, ward: 1 });

const PollingUnit = mongoose.models.PollingUnit || mongoose.model("PollingUnit", PollingUnitSchema);

export default PollingUnit;