


import React, { useState } from 'react';
import { useOfflineForm } from '../hooks/useOfflineForm';
import { useLocations } from '../hooks/useLocations';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import PassportPhotoUpload from './PassportPhotoUpload';
import { uploadPhotoToCloudinary } from '../utils/cloudinaryUpload';
// Place the uploaded logo file at src/assets/apc-logo.png — Vite will
// bundle and hash it, unlike a public/ reference, so browser caching
// doesn't serve a stale copy if you swap the file later.
import apcLogo from '../assets/apc-logo.jpeg';

// ---------------------------------------------------------------------------
// Validation
//
// NIN: NIMC issues an 11-digit numeric National Identification Number.
// Account number: Nigerian NUBAN standard is exactly 10 digits.
// PVC number: INEC has no single published fixed-length format across all
// card generations. 10–19 alphanumeric characters is a reasonable bound based
// on observed VIN/PVC lengths — tighten this if you have the exact spec.
// Phone: Nigerian mobile numbers, local (0...) or international (+234...).
// ---------------------------------------------------------------------------
const NIN_REGEX = /^\d{11}$/;
const ACCOUNT_NO_REGEX = /^\d{10}$/;
const PVC_REGEX = /^[A-Za-z0-9]{10,19}$/;
const PHONE_REGEX = /^(?:\+234|0)[7-9]\d{9}$/;

function validateField(name, value) {
  const trimmed = (value || '').trim();
  switch (name) {
    case 'nin':
      if (!trimmed) return 'NIN is required.';
      if (!NIN_REGEX.test(trimmed)) return 'NIN must be exactly 11 digits.';
      return '';
    case 'pvcNumber':
      if (!trimmed) return 'PVC number is required.';
      if (!PVC_REGEX.test(trimmed)) return 'Check the number on your card — it looks too short or too long.';
      return '';
    case 'accountNo':
      if (!trimmed) return 'Account number is required.';
      if (!ACCOUNT_NO_REGEX.test(trimmed)) return 'Account number must be exactly 10 digits.';
      return '';
    case 'telNo':
      if (!trimmed) return 'Phone number is required.';
      if (!PHONE_REGEX.test(trimmed)) return 'Enter a valid Nigerian number, e.g. 08012345678.';
      return '';
    default:
      return '';
  }
}

function SectionHeading({ letter, title }) {
  return (
    <div className="flex items-baseline gap-3 mb-1">
      <span
        className="font-mono text-[11px] font-semibold text-puc-brass border border-puc-brass/50 rounded px-1.5 py-0.5"
      >
        PART {letter}
      </span>
      <h3 className="font-body text-xs font-bold uppercase tracking-[0.15em] text-puc-green">
        {title}
      </h3>
    </div>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="text-[11px] text-puc-error mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-puc-paper-line rounded-md text-sm text-puc-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-puc-green/40 focus:border-puc-green transition-colors";
const errorInputClass =
  "w-full px-3 py-2.5 bg-white border border-puc-error rounded-md text-sm text-puc-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-puc-error/40 focus:border-puc-error transition-colors";
const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-puc-ink/70 mb-1";

const EMPTY_FORM = {
  fullName: '', address: '', telNo: '', email: '', sex: '', dateOfBirth: '', maritalStatus: '',
  lga: '', ward: '', puName: '', puCode: '', pvcNumber: '', nin: '',
  bankDetails: { bankName: '', accountNo: '', accountName: '' }
};

const EMPTY_FIELD_ERRORS = { nin: '', pvcNumber: '', accountNo: '', telNo: '' };

export default function FormManager() {
  const { isOnline, queueCount, syncing, syncErrors, dismissSyncError, submitForm, triggerManualSync } = useOfflineForm();
  const {
    lgas, wards, pollingUnits,
    selectedLga, selectedWard,
    selectLga, selectWard,
    loadingLgas, loadingWards, loadingPUs,
    error: locationError,
  } = useLocations();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [uiMessage, setUiMessage] = useState({ text: '', type: '' });
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Bumped after every successful submission to force PassportPhotoUpload to
  // remount, which clears any preview/blob state it holds internally.
  // Resetting the parent's photoBlob alone doesn't reach into the child's
  // own state, which is why the old photo was sticking around.
  const [photoResetKey, setPhotoResetKey] = useState(0);

  const handlePhotoReady = (blob) => {
    setPhotoBlob(blob);
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleTopLevelChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    // Sanitize as the person types so bad characters never make it into
    // state, rather than only catching them at submit time.
    if (name === 'nin') {
      nextValue = value.replace(/\D/g, '').slice(0, 11);
    } else if (name === 'pvcNumber') {
      nextValue = value.replace(/\s/g, '').toUpperCase().slice(0, 19);
    } else if (name === 'telNo') {
      nextValue = value.replace(/[^\d+]/g, '').slice(0, 14);
    }

    setFormData(prev => ({ ...prev, [name]: nextValue }));
    // Clear a stale error the moment the field changes; full re-check happens on blur/submit.
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    if (name === 'accountNo') {
      nextValue = value.replace(/\D/g, '').slice(0, 10);
      if (fieldErrors.accountNo) {
        setFieldErrors(prev => ({ ...prev, accountNo: '' }));
      }
    }

    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: nextValue }
    }));
  };

  const handleLgaChange = (e) => {
    const lga = e.target.value;
    selectLga(lga);
    setFormData(prev => ({ ...prev, lga, ward: '', puName: '', puCode: '' }));
  };

  const handleWardChange = (e) => {
    const ward = e.target.value;
    selectWard(ward);
    setFormData(prev => ({ ...prev, ward, puName: '', puCode: '' }));
  };

  const handlePuChange = (e) => {
    const puCode = e.target.value;
    const pu = pollingUnits.find(p => p.puCode === puCode);
    setFormData(prev => ({ ...prev, puCode, puName: pu ? pu.puName : '' }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setUiMessage({ text: '', type: '' });

    if (!formData.fullName || !formData.telNo || !formData.lga || !formData.puCode || !formData.bankDetails.accountNo) {
      setUiMessage({ text: 'Please complete all required (*) fields before submitting.', type: 'error' });
      return;
    }
    if (!photoBlob) {
      setUiMessage({ text: 'Please add a passport photograph before submitting.', type: 'error' });
      return;
    }

    // Re-run strict validation on the fields that must be accurate, rather
    // than trusting whatever passed onBlur — this is the last gate before
    // the record is persisted.
    const nextFieldErrors = {
      nin: validateField('nin', formData.nin),
      pvcNumber: validateField('pvcNumber', formData.pvcNumber),
      accountNo: validateField('accountNo', formData.bankDetails.accountNo),
      telNo: validateField('telNo', formData.telNo),
    };
    const hasFieldErrors = Object.values(nextFieldErrors).some(Boolean);
    if (hasFieldErrors) {
      setFieldErrors(nextFieldErrors);
      setUiMessage({ text: 'Please fix the highlighted fields — these must match your official documents exactly.', type: 'error' });
      return;
    }

    if (!detailsConfirmed) {
      setUiMessage({ text: 'Please confirm that your NIN, PVC number, and bank details are accurate.', type: 'error' });
      return;
    }

    let submissionPayload = { ...formData };

    if (isOnline) {
      setPhotoUploading(true);
      try {
        const { url, publicId } = await uploadPhotoToCloudinary(photoBlob);
        submissionPayload = { ...submissionPayload, photoUrl: url, photoPublicId: publicId };
      } catch (err) {
        setPhotoUploading(false);
        setUiMessage({ text: err.message || 'Photo upload failed. Please try again.', type: 'error' });
        return;
      }
      setPhotoUploading(false);
    } else {
      // TODO(offline queueing): useOfflineForm currently doesn't know
      // about binary attachments. Attaching the raw Blob here only
      // works once that hook's persistence layer is IndexedDB (not
      // localStorage, which can't hold Blobs and has a ~5-10MB cap)
      // and its sync routine is updated to call
      // uploadPhotoToCloudinary(photoBlob) for each queued item before
      // submitting its form data. Wiring this fully requires seeing
      // that hook's current implementation.
      submissionPayload = { ...submissionPayload, photoBlob };
    }

    const result = await submitForm(submissionPayload);

    if (!result.success) {
      setUiMessage({ text: result.error, type: 'error' });
      return;
    }

    setFormData(EMPTY_FORM);
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setDetailsConfirmed(false);
    setPhotoBlob(null);
    setPhotoResetKey(k => k + 1); // forces PassportPhotoUpload to remount and drop its preview
    selectLga('');

    if (result.status === 'online') {
      setUiMessage({ text: 'Your nomination has been received and recorded.', type: 'success' });
    } else {
      setUiMessage({ text: 'Saved on this device. It will be submitted automatically once you are back online.', type: 'warning' });
    }
  };

  return (
    <div className="min-h-screen security-weave py-8 px-4 sm:px-6 lg:px-8 font-body">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Connectivity status — quiet, functional, not a hero element */}
        <div className={`px-4 py-2.5 rounded-md border flex items-center justify-between text-xs ${
          isOnline ? 'bg-white border-puc-paper-line text-puc-ink/70' : 'bg-puc-brass-soft border-puc-brass/40 text-puc-ink'
        }`}>
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-puc-green" /> : <WifiOff className="h-3.5 w-3.5 text-puc-brass" />}
            <span className="font-medium">
              {isOnline ? 'Connected — submissions are sent immediately' : 'Offline — your entry will be saved on this device'}
            </span>
          </div>
          {queueCount > 0 && (
            <button onClick={triggerManualSync} disabled={syncing || !isOnline} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-puc-paper-line font-semibold hover:bg-puc-paper">
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} /> Send {queueCount} saved {queueCount === 1 ? 'entry' : 'entries'}
            </button>
          )}
        </div>

        {syncErrors.length > 0 && (
          <div className="space-y-2">
            {syncErrors.map((err) => (
              <div key={err.localId} className="p-3 rounded-md border bg-puc-error/5 border-puc-error/30 text-puc-error text-xs flex items-center justify-between gap-3">
                <span><strong>{err.fullName || 'A saved entry'}</strong> could not be submitted: {err.error}</span>
                <button onClick={() => dismissSyncError(err.localId)} className="shrink-0 font-bold underline">Dismiss</button>
              </div>
            ))}
          </div>
        )}

        {/* The document itself */}
        <div className="bg-white rounded-md border border-puc-paper-line shadow-[0_1px_3px_rgba(15,81,50,0.08)] overflow-hidden">

          {/* Letterhead */}
          <div className="relative bg-puc-green text-white px-6 py-7 overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, currentColor 0px, currentColor 1px, transparent 1px, transparent 10px)',
              }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-puc-brass-soft">
                  All Progressives Congress Lagos State Chapter
                </p>
                <h1 className="font-display text-2xl font-bold tracking-tight mt-1">
                  Polling Unit Committee
                </h1>
                <p className="font-body text-sm text-white/75 mt-0.5">Member's Nomination Form</p>
              </div>
              <div className="shrink-0 bg-white rounded-md p-1.5 shadow-sm border border-black/5">
                <img
                  src={apcLogo}
                  alt="All Progressives Congress logo"
                  className="h-14 w-14 object-contain"
                />
              </div>
            </div>

          </div>

          <form onSubmit={handleFormSubmit} className="p-6 space-y-7">

            {/* PART A */}
            <div className="space-y-4">
              <SectionHeading letter="A" title="Personal Information" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="md:col-span-2">
                  <PassportPhotoUpload key={photoResetKey} onPhotoReady={handlePhotoReady} disabled={photoUploading} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Full Name *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleTopLevelChange} className={inputClass} placeholder="SURNAME Firstname Othername" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Residential Address *</label>
                  <input type="text" name="address" value={formData.address} onChange={handleTopLevelChange} className={inputClass} placeholder="Street, house number, ward area" />
                </div>
                <div>
                  <label className={labelClass}>Telephone Number *</label>
                  <input
                    type="tel" name="telNo" value={formData.telNo} onChange={handleTopLevelChange} onBlur={handleFieldBlur}
                    inputMode="tel" className={fieldErrors.telNo ? errorInputClass : inputClass} placeholder="08012345678"
                  />
                  <FieldError message={fieldErrors.telNo} />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleTopLevelChange} className={inputClass} placeholder="nominee@domain.com" />
                </div>
                <div>
                  <label className={labelClass}>Sex *</label>
                  <select name="sex" value={formData.sex} onChange={handleTopLevelChange} className={`${inputClass} bg-white`}>
                    <option value="">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date of Birth *</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleTopLevelChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Marital Status *</label>
                  <select name="maritalStatus" value={formData.maritalStatus} onChange={handleTopLevelChange} className={`${inputClass} bg-white`}>
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-puc-paper-line" />

            {/* PART B */}
            <div className="space-y-4">
              <SectionHeading letter="B" title="LGA Details" />

              {locationError && (
                <p className="text-xs font-medium text-puc-error bg-puc-error/5 border border-puc-error/30 rounded-md p-2.5">{locationError}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className={labelClass}>LGA *</label>
                  <select name="lga" value={selectedLga} onChange={handleLgaChange} disabled={loadingLgas} className={`${inputClass} bg-white disabled:opacity-60`}>
                    <option value="">{loadingLgas ? 'Loading…' : 'Select LGA'}</option>
                    {lgas.map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Ward *</label>
                  <select name="ward" value={selectedWard} onChange={handleWardChange} disabled={!selectedLga || loadingWards} className={`${inputClass} bg-white disabled:opacity-60`}>
                    <option value="">{!selectedLga ? 'Select an LGA first' : loadingWards ? 'Loading…' : 'Select Ward'}</option>
                    {wards.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Polling Unit *</label>
                  <select name="puCode" value={formData.puCode} onChange={handlePuChange} disabled={!selectedWard || loadingPUs} className={`${inputClass} bg-white disabled:opacity-60`}>
                    <option value="">{!selectedWard ? 'Select a ward first' : loadingPUs ? 'Loading…' : 'Select Polling Unit'}</option>
                    {pollingUnits.map((pu) => <option key={pu.puCode} value={pu.puCode}>{pu.puName} — {pu.puCode}</option>)}
                  </select>
                  {formData.puCode && (
                    <p className="font-mono text-[11px] text-puc-green mt-1.5">PU Code: {formData.puCode}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>PVC Number *</label>
                  <input
                    type="text" name="pvcNumber" value={formData.pvcNumber} onChange={handleTopLevelChange} onBlur={handleFieldBlur}
                    className={fieldErrors.pvcNumber ? `${errorInputClass} font-mono` : `${inputClass} font-mono`}
                    placeholder="Enter full card number"
                  />
                  <FieldError message={fieldErrors.pvcNumber} />
                </div>
                <div>
                  <label className={labelClass}>NIN *</label>
                  <input
                    type="text" name="nin" value={formData.nin} onChange={handleTopLevelChange} onBlur={handleFieldBlur}
                    inputMode="numeric" maxLength={11}
                    className={fieldErrors.nin ? `${errorInputClass} font-mono` : `${inputClass} font-mono`}
                    placeholder="11-digit number"
                  />
                  <FieldError message={fieldErrors.nin} />
                </div>
              </div>
            </div>

            <div className="border-t border-puc-paper-line" />

            {/* PART C */}
            <div className="space-y-4">
              <SectionHeading letter="C" title="Account Details" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className={labelClass}>Bank Name *</label>
                  <input type="text" name="bankName" value={formData.bankDetails.bankName} onChange={handleBankChange} className={inputClass} placeholder="e.g. GTBank" />
                </div>
                <div>
                  <label className={labelClass}>Account Number *</label>
                  <input
                    type="text" name="accountNo" value={formData.bankDetails.accountNo} onChange={handleBankChange} onBlur={handleFieldBlur}
                    inputMode="numeric" maxLength={10}
                    className={fieldErrors.accountNo ? `${errorInputClass} font-mono` : `${inputClass} font-mono`}
                    placeholder="10 digits"
                  />
                  <FieldError message={fieldErrors.accountNo} />
                </div>
                <div>
                  <label className={labelClass}>Account Name *</label>
                  <input type="text" name="accountName" value={formData.bankDetails.accountName} onChange={handleBankChange} className={inputClass} placeholder="Must match full name" />
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox" id="detailsConfirmed" checked={detailsConfirmed}
                  onChange={(e) => setDetailsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-puc-paper-line text-puc-green focus:ring-puc-green/40 shrink-0"
                />
                <label htmlFor="detailsConfirmed" className="text-xs text-puc-ink/80 leading-relaxed">
                  I confirm that the NIN, PVC number, and bank details above are correct and match my official
                  documents. I understand that incorrect details may delay or invalidate my nomination.
                </label>
              </div>
            </div>

            {uiMessage.text && (
              <div className={`p-3 rounded-md text-xs font-medium border ${
                uiMessage.type === 'success' ? 'bg-puc-green/5 border-puc-green/30 text-puc-green-dark' :
                uiMessage.type === 'warning' ? 'bg-puc-brass-soft border-puc-brass/40 text-puc-ink' :
                'bg-puc-error/5 border-puc-error/30 text-puc-error'
              }`}>
                {uiMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={photoUploading}
              className="w-full bg-puc-green hover:bg-puc-green-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md text-sm tracking-wide shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-puc-green/50 focus:ring-offset-2"
            >
              {photoUploading ? 'Uploading photo…' : 'Submit Nomination'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-puc-ink/40">
          Information submitted here is used solely for Polling Unit Committee administration.
        </p>
      </div>
    </div>
  );
}