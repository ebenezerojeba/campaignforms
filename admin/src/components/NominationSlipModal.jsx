import React, { useState, useEffect, useCallback } from 'react';
import { X, Printer, Download, Loader2, Pencil } from 'lucide-react';
import { generateNominationSlipPdf } from '../utils/generateNominationSlipPdf';
import apcLogo from '../assets/apc-logo.jpeg';

function slipReference(nominee) {
  const raw = nominee?._id || '';
  return `PUC-${raw.slice(-8).toUpperCase() || 'UNKNOWN'}`;
}

function Row({ label, value }) {
  return (
    <div className="break-words">
      <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide text-puc-ink/50">{label}</p>
      <p className="text-xs sm:text-sm text-puc-ink break-words">{value || '—'}</p>
    </div>
  );
}

export default function NominationSlipModal({ nominee, onClose, onEdit }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!nominee) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      let logoDataUrl = null;
      try {
        const res = await fetch(apcLogo);
        const blob = await res.blob();
        logoDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        // Logo is cosmetic — proceed without it rather than blocking the download.
      }
      await generateNominationSlipPdf(nominee, logoDataUrl);
    } catch (err) {
      console.error('Slip PDF generation failed:', err);
      setDownloadError('Could not generate the PDF. You can still use Print.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="nomination-slip-modal fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Nomination slip for ${nominee.fullName}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-md shadow-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none mx-2 sm:mx-0"
      >
        {/* Toolbar — hidden when printing */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 px-3 sm:px-5 py-2 sm:py-3 border-b border-puc-paper-line print:hidden">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-puc-ink/60">Nomination Slip</p>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {onEdit && (
              <button
                onClick={() => onEdit(nominee)}
                className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 rounded border text-puc-ink border-puc-paper-line hover:bg-puc-paper flex-1 sm:flex-none justify-center"
              >
                <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Edit
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 rounded border text-green-700 border-puc-paper-line hover:bg-puc-paper flex-1 sm:flex-none justify-center"
            >
              <Printer className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Print
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 rounded bg-puc-green text-white hover:bg-puc-green-dark disabled:opacity-60 flex-1 sm:flex-none justify-center"
            >
              {downloading ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-puc-paper text-puc-ink/50" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {downloadError && (
          <p className="px-3 sm:px-5 pt-2 sm:pt-3 text-[10px] sm:text-xs font-medium text-puc-error print:hidden">{downloadError}</p>
        )}

        {/* Printable slip content */}
        <div className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-puc-paper-line">
            <div className="w-full sm:w-auto">
              <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-puc-brass">All Progressives Congress Lagos State</p>
              <h2 className="font-display text-base sm:text-lg font-bold text-puc-green mt-0.5">Polling Unit Committee</h2>
              <p className="text-[10px] sm:text-xs text-puc-ink/60">Member's Nomination Slip</p>
              <p className="font-mono text-[10px] sm:text-[11px] text-puc-green mt-1.5">{slipReference(nominee)}</p>
            </div>
            {nominee.photoUrl ? (
              <img
                src={nominee.photoUrl}
                alt={`${nominee.fullName}'s passport photograph`}
                className="h-20 w-16 sm:h-24 sm:w-20 object-cover rounded border border-puc-paper-line flex-shrink-0"
              />
            ) : (
              <div className="h-20 w-16 sm:h-24 sm:w-20 rounded border border-puc-paper-line bg-puc-paper flex items-center justify-center text-[8px] sm:text-[9px] text-puc-ink/40 uppercase font-semibold flex-shrink-0">
                No Photo
              </div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-5 pt-3 sm:pt-4">
            <div className="space-y-2 sm:space-y-3">
              <p className="font-mono text-[10px] sm:text-[11px] font-semibold text-puc-brass">Part A — Personal Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="sm:col-span-2"><Row label="Full Name" value={nominee.fullName} /></div>
                <div className="sm:col-span-2"><Row label="Residential Address" value={nominee.address} /></div>
                <Row label="Telephone" value={nominee.telNo} />
                <Row label="Email" value={nominee.email} />
                <Row label="Sex" value={nominee.sex === 'M' ? 'Male' : nominee.sex === 'F' ? 'Female' : nominee.sex} />
                <Row label="Date of Birth" value={nominee.dateOfBirth ? new Date(nominee.dateOfBirth).toLocaleDateString('en-NG') : ''} />
                <Row label="Marital Status" value={nominee.maritalStatus} />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <p className="font-mono text-[10px] sm:text-[11px] font-semibold text-puc-brass">Part B — LGA Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <Row label="LGA" value={nominee.lga} />
                <Row label="Ward" value={nominee.ward} />
                <div className="sm:col-span-2">
                  <Row label="Polling Unit" value={nominee.puName ? `${nominee.puName} (${nominee.puCode})` : nominee.puCode} />
                </div>
                <Row label="PVC Number" value={nominee.pvcNumber} />
                <Row label="NIN" value={nominee.nin} />
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <p className="font-mono text-[10px] sm:text-[11px] font-semibold text-puc-brass">Part C — Account Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <Row label="Bank Name" value={nominee.bankDetails?.bankName} />
                <Row label="Account Number" value={nominee.bankDetails?.accountNo} />
                <div className="sm:col-span-2"><Row label="Account Name" value={nominee.bankDetails?.accountName} /></div>
              </div>
            </div>
          </div>

          <p className="text-[8px] sm:text-[10px] text-puc-ink/40 pt-3 sm:pt-5 mt-3 sm:mt-5 border-t border-puc-paper-line">
            System-generated slip · {new Date().toLocaleString('en-NG')} · Not valid without matching records in the PUC nomination database.
          </p>
        </div>
      </div>
    </div>
  );
}