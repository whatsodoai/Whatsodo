import axios from "axios";
import { env } from "../config/env";

const GRAPH_VERSION = "v25.0";

/**
 * Exchanges the authorization `code` returned by the WhatsApp Embedded
 * Signup JS SDK flow for a long-lived System User access token scoped to
 * the WABA the business owner just connected.
 */
export const exchangeCodeForToken = async (code: string): Promise<string> => {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    {
      params: {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        code,
      },
    }
  );

  return response.data.access_token;
};

/**
 * Subscribes this Meta App to the business's WABA so webhook events
 * (incoming messages, status updates) start flowing for that number.
 * Best-effort by design — callers should not fail the connect request if
 * this throws, since the credentials are still valid without it.
 */
export const subscribeAppToWaba = async (
  wabaId: string,
  accessToken: string
): Promise<void> => {
  await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
};

export interface PhoneNumberDetails {
  display_phone_number?: string;
  verified_name?: string;
}

/**
 * Looks up the connected number's display info, purely so the UI can show
 * the user which number got linked. Best-effort — callers should not fail
 * the connect request if this throws.
 */
export const getPhoneNumberDetails = async (
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberDetails> => {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`,
    {
      params: { fields: "display_phone_number,verified_name" },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data;
};
