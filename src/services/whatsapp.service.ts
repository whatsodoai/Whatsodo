import axios from "axios";

const WHATSAPP_TEXT_LIMIT = 4096;

export interface WhatsAppCredentials {
  accessToken?: string;
  phoneNumberId?: string;
}

export const sendWhatsAppMessage = async (
  to: string,
  message: string,
  credentials?: WhatsAppCredentials
) => {
  try {
    if (message.length > WHATSAPP_TEXT_LIMIT) {
      console.error(
        `WHATSAPP API: message length ${message.length} exceeds ${WHATSAPP_TEXT_LIMIT}-char limit, truncating.`
      );
      message = message.slice(0, WHATSAPP_TEXT_LIMIT - 1) + "…";
    }

    // Per-business credentials (Settings page) take priority; fall back to
    // the global env vars so businesses that haven't configured their own
    // WhatsApp account yet keep working.
    const phoneNumberId =
      credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    const accessToken =
      credentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.error(
        "WHATSAPP API ERROR: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN env var"
      );
      throw new Error("WhatsApp credentials are not configured");
    }

    const url =
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.log(
      "WHATSAPP API ERROR:",
      error?.response?.data || error.message
    );
    throw error;
  }
};

export interface WhatsAppTemplatePayload {
  name: string;
  language: string;
  variables?: string[];
}

/**
 * Sends an approved Meta template message — the only way to reach a
 * customer outside Meta's 24-hour free-form reply window. The template
 * must already exist/be approved in the business's Meta Business Manager;
 * this just invokes it by name.
 */
export const sendWhatsAppTemplate = async (
  to: string,
  template: WhatsAppTemplatePayload,
  credentials?: WhatsAppCredentials
) => {
  const phoneNumberId = credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = credentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials are not configured");
  }

  const components = template.variables?.length
    ? [
        {
          type: "body",
          parameters: template.variables.map((v) => ({ type: "text", text: v })),
        },
      ]
    : [];

  const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.log("WHATSAPP TEMPLATE API ERROR:", error?.response?.data || error.message);
    throw error;
  }
};
