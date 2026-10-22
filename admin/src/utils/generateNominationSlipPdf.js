import { jsPDF } from 'jspdf';

// ---------------------------------------------------------------------------
// Cloudinary delivery URLs are served with permissive CORS headers by
// default, so a plain fetch() usually works here even though the image is
// cross-origin. If that assumption doesn't hold for your Cloudinary config
// (or the network fails), this throws and the caller falls back to
// rendering the slip without the photo rather than blocking the download.
// ---------------------------------------------------------------------------
async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const blob = await res.blob();
  const format = blob.type === 'image/png' ? 'PNG' : blob.type === 'image/webp' ? 'WEBP' : 'JPEG';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { dataUrl, format };
}

function slipReference(nominee) {
  const raw = nominee?._id || '';
  return `PUC-${raw.slice(-8).toUpperCase() || 'UNKNOWN'}`;
}

/**
 * Renders a single nominee's record as a one-page (usually) PDF slip and
 * triggers a browser download. Drawn directly with jsPDF's text/shape APIs
 * rather than rasterizing the on-screen modal, so the output has crisp,
 * selectable text and predictable pagination if a field (e.g. a long
 * address) runs long.
 *
 * @param {object} nominee - a submission record as returned by the admin API
 * @param {string|null} logoDataUrl - base64 data URL of the party logo, or
 *   null to omit it (logo is cosmetic, never blocks generation)
 */
export async function generateNominationSlipPdf(nominee, logoDataUrl) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  function ensureSpace(neededHeight) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ---- Letterhead ----
  doc.setFillColor(15, 81, 50); // puc-green
  doc.rect(0, 0, pageWidth, 90, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'JPEG', pageWidth - margin - 48, 21, 48, 48);
    } catch (err) {
      console.warn('Could not embed party logo in slip PDF:', err); // non-fatal, logo just omitted
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ALL PROGRESSIVES CONGRESS LAGOS STATE', margin, 34);
  doc.setFontSize(16);
  doc.text('Polling Unit Committee', margin, 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text("Member's Nomination Slip", margin, 70);

  y = 120;
  doc.setTextColor(20, 20, 20);

  // ---- Reference + timestamp ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Reference: ${slipReference(nominee)}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-NG')}`, pageWidth - margin, y, { align: 'right' });
  y += 24;

  // ---- Photo (top-right column) ----
  const photoW = 90;
  const photoH = 108;
  if (nominee.photoUrl) {
    try {
      const { dataUrl, format } = await urlToDataUrl(nominee.photoUrl);
      doc.addImage(dataUrl, format, pageWidth - margin - photoW, y, photoW, photoH);
    } catch (err) {
      console.warn('Could not embed nominee photo in slip PDF:', err);
      doc.setDrawColor(180);
      doc.rect(pageWidth - margin - photoW, y, photoW, photoH);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text('Photo unavailable', pageWidth - margin - photoW + 8, y + photoH / 2);
      doc.setTextColor(20, 20, 20);
    }
  }

  const contentWidth = pageWidth - margin * 2 - (photoW + 20); // leave room for the photo column

  function sectionHeading(letter, title) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 120, 60); // puc-brass-ish
    doc.text(`PART ${letter}`, margin, y);
    doc.setTextColor(15, 81, 50); // puc-green
    doc.text(title.toUpperCase(), margin + 55, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(margin, y, margin + contentWidth, y);
    y += 16;
    doc.setTextColor(20, 20, 20);
  }

  function field(label, value) {
    const lines = doc.splitTextToSize(String(value || '—'), contentWidth);
    ensureSpace(13 + lines.length * 13 + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(lines, margin, y + 13);

    y += 13 + lines.length * 13 + 8;
  }

  sectionHeading('A', 'Personal Information');
  field('Full Name', nominee.fullName);
  field('Residential Address', nominee.address);
  field('Telephone Number', nominee.telNo);
  field('Email Address', nominee.email);
  field('Sex', nominee.sex === 'M' ? 'Male' : nominee.sex === 'F' ? 'Female' : nominee.sex);
  field('Date of Birth', nominee.dateOfBirth ? new Date(nominee.dateOfBirth).toLocaleDateString('en-NG') : '');
  field('Marital Status', nominee.maritalStatus);

  y += 6;
  sectionHeading('B', 'LGA Details');
  field('LGA', nominee.lga);
  field('Ward', nominee.ward);
  field('Polling Unit', nominee.puName ? `${nominee.puName} (${nominee.puCode || '—'})` : nominee.puCode);
  field('PVC Number', nominee.pvcNumber);
  field('NIN', nominee.nin);

  y += 6;
  sectionHeading('C', 'Account Details');
  field('Bank Name', nominee.bankDetails?.bankName);
  field('Account Number', nominee.bankDetails?.accountNo);
  field('Account Name', nominee.bankDetails?.accountName);

  // ---- Footer ----
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    'System-generated slip. Not valid without matching records in the PUC nomination database.',
    margin,
    pageHeight - margin
  );

  doc.save(`${slipReference(nominee)}_${(nominee.fullName || 'nominee').replace(/\s+/g, '_')}.pdf`);
}