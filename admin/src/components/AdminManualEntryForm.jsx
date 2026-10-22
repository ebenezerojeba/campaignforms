import React, { useEffect, useState } from "react";
import { UserPlus, Pencil, Loader2, ArrowLeft, Camera } from "lucide-react";
import { compressImage, uploadPhotoToCloudinary } from "../utils/cloudinaryUpload";
import { useAuth } from "../context/AuthContext";
import { useLocations } from "../hooks/useLocations";
import { API } from "../config/api";

const EMPTY_FORM = {
  fullName: "", address: "", telNo: "", email: "", sex: "", dateOfBirth: "", maritalStatus: "",
  lga: "", ward: "", puName: "", puCode: "", pvcNumber: "", nin: "",
  bankDetails: { bankName: "", accountNo: "", accountName: "" },
};

// Only the fields the server's nomination schema accepts. Anything else on a
// stored record (_id, source, timestamps…) would be rejected as unknown.
function toFormData(record) {
  if (!record) return EMPTY_FORM;
  const pick = (k) => record[k] ?? "";
  return {
    fullName: pick("fullName"), address: pick("address"), telNo: pick("telNo"), email: pick("email"),
    sex: pick("sex"), dateOfBirth: pick("dateOfBirth"), maritalStatus: pick("maritalStatus"),
    lga: pick("lga"), ward: pick("ward"), puName: pick("puName"), puCode: pick("puCode"),
    pvcNumber: pick("pvcNumber"), nin: pick("nin"),
    ...(record.photoUrl ? { photoUrl: record.photoUrl } : {}),
    ...(record.photoPublicId ? { photoPublicId: record.photoPublicId } : {}),
    bankDetails: {
      bankName: record.bankDetails?.bankName ?? "",
      accountNo: record.bankDetails?.accountNo ?? "",
      accountName: record.bankDetails?.accountName ?? "",
    },
  };
}

// Human-readable names for the server's field paths.
const FIELD_LABELS = {
  fullName: "Full name", address: "Address", telNo: "Phone", email: "Email", sex: "Sex",
  dateOfBirth: "Date of birth", maritalStatus: "Marital status", lga: "LGA", ward: "Ward",
  puName: "Polling unit", puCode: "Polling unit", pvcNumber: "PVC number", nin: "NIN",
  photoUrl: "Photo", "bankDetails.bankName": "Bank name", "bankDetails.accountNo": "Account number",
  "bankDetails.accountName": "Account name",
};

function describeError(data, fallback) {
  const base = data?.error || fallback;
  if (!Array.isArray(data?.details) || !data.details.length) return base;
  return `${base} ${data.details.map((d) => `${FIELD_LABELS[d.field] || d.field}: ${d.message}`).join(" · ")}`;
}

/**
 * Create a new nominee (no `record`) or edit an existing one (`record` given).
 * New entries need a photo URL because the server requires one; edits keep
 * the existing photo.
 */
export default function AdminManualEntryForm({ record, onSaved, onCancel }) {
  const isEdit = Boolean(record?._id);
  const { authFetch } = useAuth();
  const {
    lgas, wards, pollingUnits,
    selectedLga, selectedWard,
    selectLga, selectWard,
    loadingLgas, loadingWards, loadingPUs,
    error: locationError,
  } = useLocations();

  const [formData, setFormData] = useState(() => toFormData(record));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Edit mode: load the record's ward and polling-unit lists so the
  // dropdowns show its current location.
  useEffect(() => {
    if (!isEdit || !record.lga) return;
    (async () => {
      await selectLga(record.lga);
      if (record.ward) await selectWard(record.ward, record.lga);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, record?._id]);

  const handleTopLevelChange = (e) => {
    const { name, value } = e.target;
    let next = value;
    if (name === "nin") next = value.replace(/\D/g, "").slice(0, 11);
    if (name === "telNo") next = value.replace(/[^\d+]/g, "").slice(0, 14);
    if (name === "pvcNumber") next = value.replace(/\s/g, "").toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: next }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    const next = name === "accountNo" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setFormData((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, [name]: next } }));
  };

  const handleLgaChange = (e) => {
    const lga = e.target.value;
    selectLga(lga);
    setFormData((prev) => ({ ...prev, lga, ward: "", puName: "", puCode: "" }));
  };

  const handleWardChange = (e) => {
    const ward = e.target.value;
    selectWard(ward);
    setFormData((prev) => ({ ...prev, ward, puName: "", puCode: "" }));
  };

  const handlePuChange = (e) => {
    const puCode = e.target.value;
    const pu = pollingUnits.find((p) => p.puCode === puCode);
    setFormData((prev) => ({ ...prev, puCode, puName: pu ? pu.puName : "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (!formData.photoUrl) {
      setMessage({ text: "Add a passport photograph.", type: "error" });
      return;
    }
    if (!formData.puCode) {
      setMessage({ text: "Select the LGA, ward and polling unit.", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (!payload.email) delete payload.email;

      const res = await authFetch(isEdit ? `${API.adminSubmissions}/${record._id}` : API.adminSubmissions, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ text: describeError(data, isEdit ? "Could not update record." : "Could not create record."), type: "error" });
        return;
      }

      if (!isEdit) {
        setFormData(EMPTY_FORM);
        selectLga("");
      }
      onSaved?.(isEdit ? data.data : data.id);
    } catch {
      setMessage({ text: "Network error — please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = isEdit ? Pencil : UserPlus;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-900 text-slate-400" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-emerald-400">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-white font-black text-sm uppercase tracking-wider truncate">
            {isEdit ? `Edit: ${record.fullName}` : "Manual Nominee Entry"}
          </h2>
          <p className="text-slate-500 text-xs">
            {isEdit ? "Changes are recorded against your account" : "For records collected offline or over the phone"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name *" name="fullName" value={formData.fullName} onChange={handleTopLevelChange} className="md:col-span-2" required />
          <Field label="Residential Address *" name="address" value={formData.address} onChange={handleTopLevelChange} className="md:col-span-2" required />
          <Field label="Telephone Number *" name="telNo" value={formData.telNo} onChange={handleTopLevelChange} placeholder="08012345678" inputMode="tel" required />
          <Field label="E-Mail Address" name="email" type="email" value={formData.email} onChange={handleTopLevelChange} />
          <SelectField
            label="Sex *" name="sex" value={formData.sex} onChange={handleTopLevelChange} required
            options={[["", "Select"], ["M", "Male"], ["F", "Female"]]}
          />
          <Field label="Date of Birth *" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleTopLevelChange} required />
          <SelectField
            label="Marital Status *" name="maritalStatus" value={formData.maritalStatus} onChange={handleTopLevelChange} required
            options={[["", "Select"], ["Single", "Single"], ["Married", "Married"], ["Divorced", "Divorced"], ["Widowed", "Widowed"]]}
          />
          <PhotoField
            photoUrl={formData.photoUrl}
            onUploaded={({ url, publicId }) => setFormData((prev) => ({ ...prev, photoUrl: url, photoPublicId: publicId }))}
          />

          {locationError && (
            <p className="md:col-span-2 text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg p-2.5">{locationError}</p>
          )}

          <SelectField
            label="LGA *" name="lga" value={selectedLga} onChange={handleLgaChange} required
            options={[["", loadingLgas ? "Loading LGAs…" : "Select LGA"], ...lgas.map((l) => [l, l])]}
            disabled={loadingLgas}
          />
          <SelectField
            label="Ward *" name="ward" value={selectedWard} onChange={handleWardChange} required
            options={[["", !selectedLga ? "Select an LGA first" : loadingWards ? "Loading wards…" : "Select Ward"], ...wards.map((w) => [w, w])]}
            disabled={!selectedLga || loadingWards}
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Polling Unit *</label>
            <select
              name="puCode"
              value={formData.puCode}
              onChange={handlePuChange}
              disabled={!selectedWard || loadingPUs}
              required
              className={inputClass}
            >
              <option value="">{!selectedWard ? "Select a ward first" : loadingPUs ? "Loading polling units…" : "Select Polling Unit"}</option>
              {pollingUnits.map((pu) => (
                <option key={pu.puCode} value={pu.puCode}>{pu.puName} — {pu.puCode}</option>
              ))}
            </select>
          </div>
          <Field label="PVC Number *" name="pvcNumber" value={formData.pvcNumber} onChange={handleTopLevelChange} required />
          <Field label="NIN (11 digits) *" name="nin" value={formData.nin} onChange={handleTopLevelChange} inputMode="numeric" required />
        </div>

        <div className="pt-2 border-t border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 mt-4">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Bank Name *" name="bankName" value={formData.bankDetails.bankName} onChange={handleBankChange} required />
            <Field label="Account Number *" name="accountNo" value={formData.bankDetails.accountNo} onChange={handleBankChange} inputMode="numeric" required />
            <Field label="Account Name *" name="accountName" value={formData.bankDetails.accountName} onChange={handleBankChange} required />
          </div>
        </div>

        {message.text && (
          <div
            role="alert"
            className={`p-3 rounded-lg text-xs font-bold border ${
              message.type === "success"
                ? "bg-emerald-950/40 border-emerald-900 text-emerald-300"
                : "bg-rose-950/40 border-rose-900 text-rose-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="sm:w-40 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold py-3 rounded-xl text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Nominee Record"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60";

function Field({ label, name, value, onChange, type = "text", className = "", ...rest }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-xs font-bold uppercase text-slate-400 mb-1">{label}</label>
      <input id={name} type={type} name={name} value={value} onChange={onChange} className={inputClass} {...rest} />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, disabled = false, required = false }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-bold uppercase text-slate-400 mb-1">{label}</label>
      <select id={name} name={name} value={value} onChange={onChange} disabled={disabled} required={required} className={inputClass}>
        {options.map(([val, text]) => (
          <option key={val} value={val}>{text}</option>
        ))}
      </select>
    </div>
  );
}

// Passport photo: pick a file, shrink it in the browser, upload to Cloudinary.
function PhotoField({ photoUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const blob = await compressImage(file);
      onUploaded(await uploadPhotoToCloudinary(blob));
    } catch (err) {
      setError(err.message || "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="block text-xs font-bold uppercase text-slate-400 mb-1">Passport Photo *</span>
      <div className="flex items-center gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt="Nominee" className="h-12 w-10 object-cover rounded border border-slate-700" />
        ) : (
          <div className="h-12 w-10 rounded border border-dashed border-slate-700 bg-slate-950" />
        )}
        <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold uppercase px-3 py-2.5 rounded-lg">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {uploading ? "Uploading…" : photoUrl ? "Replace" : "Upload"}
          <input type="file" accept="image/*" capture="user" className="sr-only" onChange={handleFile} disabled={uploading} />
        </label>
      </div>
      {error && <p className="text-[11px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
}
