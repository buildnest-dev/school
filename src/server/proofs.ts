import { HttpError } from "./auth";

/** Largest screenshot we keep. The phone compresses to about 100 KB first; this is only a safety cap. */
export const MAX_PROOF_BYTES = 500 * 1024;

/**
 * Turns the uploaded text (base64, with or without a data-URL prefix) into JPEG bytes. Only real
 * JPEG files are kept, so nothing else can be stored or served back as an "image".
 */
export function readProofImage(input: string): Buffer {
  const b64 = input.replace(/^data:image\/jpeg;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64))
    throw new HttpError(422, "bad_image", "The screenshot could not be read.");
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff)
    throw new HttpError(422, "bad_image", "Upload a photo or screenshot (JPEG).");
  if (buf.length > MAX_PROOF_BYTES)
    throw new HttpError(422, "image_too_big", "That image is too large. Try a smaller screenshot.");
  return buf;
}
