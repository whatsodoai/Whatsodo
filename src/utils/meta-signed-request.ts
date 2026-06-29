import crypto from "crypto";
import { env } from "../config/env";

const base64UrlDecode = (input: string): Buffer => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
};

export interface DecodedSignedRequest {
  algorithm: string;
  issued_at: number;
  user_id: string;
  [key: string]: unknown;
}

/**
 * Verifies and decodes the `signed_request` field Meta posts to the
 * Deauthorize and Data Deletion Request callbacks. Returns null if the
 * HMAC signature doesn't match — callers must treat that as untrusted input.
 */
export const verifySignedRequest = (
  signedRequest: string
): DecodedSignedRequest | null => {
  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) return null;

  const expectedSig = crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(encodedPayload)
    .digest();

  const actualSig = base64UrlDecode(encodedSig);
  if (
    actualSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(actualSig, expectedSig)
  ) {
    return null;
  }

  return JSON.parse(base64UrlDecode(encodedPayload).toString("utf-8"));
};
