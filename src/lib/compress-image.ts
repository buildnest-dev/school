/**
 * Shrinks a photo or screenshot on the phone before it is sent: at most 1280 px on the long side,
 * saved as JPEG at a quality that keeps it under about 300 KB. Returns base64 (no prefix).
 */
export async function compressImage(file: File, maxBytes = 300 * 1024): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo or screenshot.");
  const bitmap = await createImageBitmap(file);
  let side = 1280;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot prepare the image.");
    ctx.fillStyle = "#fff"; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const quality = Math.max(0.4, 0.8 - attempt * 0.08);
    const b64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
    if ((b64.length * 3) / 4 <= maxBytes) return b64;
    side = Math.round(side * 0.8);
  }
  throw new Error("That image is too large. Try a smaller screenshot.");
}
