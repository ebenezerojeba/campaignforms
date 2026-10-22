/**
 * Resizes an image file down to a max dimension and re-encodes it as a
 * JPEG at the given quality. A raw phone photo (3-8MB, 3000-4000px on
 * the long edge) has no business traveling over a poor connection at
 * full size for a form field that's displayed as a small photo — this
 * routinely gets it under ~150-250KB with no visible quality loss at
 * the sizes this photo is ever actually shown at.
 *
 * Returns a Blob (not a File) — File-specific metadata (original name,
 * lastModified) isn't needed once we're re-encoding the pixels anyway.
 */
export function compressImage(file, { maxDimension = 800, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height >= width && height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not process the image. Please try a different photo."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That file doesn't look like a valid image."));
    };

    img.src = objectUrl;
  });
}

/**
 * Fetches a signed upload signature from our backend, then uploads
 * directly to Cloudinary. The API secret never touches the browser —
 * only a short-lived, single-folder-scoped signature does.
 */
export async function uploadPhotoToCloudinary(blob) {
  const sigRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/uploads/photo-signature`);
  if (!sigRes.ok) {
    throw new Error("Could not prepare the photo upload. Please try again.");
  }
  const { signature, timestamp, folder, apiKey, cloudName } = await sigRes.json();

  const body = new FormData();
  body.append("file", blob, "passport-photo.jpg");
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("signature", signature);
  body.append("folder", folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || "Photo upload failed. Please try again.");
  }

  const data = await uploadRes.json();
  return { url: data.secure_url, publicId: data.public_id };
}