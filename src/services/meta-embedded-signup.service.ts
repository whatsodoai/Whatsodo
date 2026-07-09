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

/**
 * Looks up the Facebook user_id behind the access token, so it can be
 * stored on the Business and matched later against the `user_id` field in
 * Meta's deauthorize / data-deletion signed_request callbacks.
 */
export const getMetaUserId = async (accessToken: string): Promise<string | null> => {
  try {
    const response = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me`, {
      params: { fields: "id" },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data.id ?? null;
  } catch (err) {
    console.error("Failed to fetch Meta user id:", err);
    return null;
  }
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

export interface CoexistenceVerification {
  isOnBizApp: boolean;
  isCloudApi: boolean;
}

/**
 * Verifies that the coexistence onboarding completed successfully by checking
 * is_on_biz_app === true and platform_type === "CLOUD_API" on the phone number.
 */
export const verifyCoexistenceOnboarding = async (
  phoneNumberId: string,
  accessToken: string
): Promise<CoexistenceVerification> => {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`,
      {
        params: { fields: "is_on_biz_app,platform_type" },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return {
      isOnBizApp: response.data.is_on_biz_app === true,
      isCloudApi: response.data.platform_type === "CLOUD_API",
    };
  } catch (err) {
    console.error("Failed to verify coexistence onboarding:", err);
    return { isOnBizApp: false, isCloudApi: false };
  }
};

/**
 * Initiates contact synchronization from the WhatsApp Business App.
 * Triggers smb_app_state_sync webhook events describing existing contacts.
 */
export const initiateContactsSync = async (
  phoneNumberId: string,
  accessToken: string
): Promise<string | null> => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/smb_app_data`,
      { messaging_product: "whatsapp", sync_type: "smb_app_state_sync" },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data.request_id ?? null;
  } catch (err: any) {
    console.error("Failed to initiate contacts sync:", err?.response?.data || err.message);
    return null;
  }
};

/**
 * Initiates message history synchronization from the WhatsApp Business App.
 * Triggers history webhook events. Must be called within 24 hours of onboarding.
 */
export const initiateHistorySync = async (
  phoneNumberId: string,
  accessToken: string
): Promise<string | null> => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/smb_app_data`,
      { messaging_product: "whatsapp", sync_type: "history" },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data.request_id ?? null;
  } catch (err: any) {
    console.error("Failed to initiate history sync:", err?.response?.data || err.message);
    return null;
  }
};

/**
 * Subscribes the app to coexistence-required WABA webhook fields:
 * history, smb_app_state_sync, and smb_message_echoes.
 */
export interface WabaPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
}

/**
 * Fetches all phone numbers registered under a WABA.
 * Used in the coexistence flow where FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING
 * only returns waba_id (no phone_number_id), so we derive it from the WABA.
 */
export const getWabaPhoneNumbers = async (
  wabaId: string,
  accessToken: string
): Promise<WabaPhoneNumber[]> => {
  const response = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/phone_numbers`,
    {
      params: { fields: "id,display_phone_number,verified_name" },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return response.data.data ?? [];
};

export const subscribeCoexistenceWebhooks = async (
  wabaId: string,
  accessToken: string
): Promise<void> => {
  await axios.post(
    `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`,
    {
      subscribed_fields: ["messages", "history", "smb_app_state_sync", "smb_message_echoes"],
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
};
