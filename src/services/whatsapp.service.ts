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

export interface WhatsAppMediaOptions {
  caption?: string;
  filename?: string;
}

export const sendWhatsAppMedia = async (
  to: string,
  type: "image" | "video" | "document",
  url: string,
  options?: WhatsAppMediaOptions,
  credentials?: WhatsAppCredentials
) => {
  const phoneNumberId =
    credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken =
    credentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp credentials are not configured");
  }

  const mediaObject: Record<string, string> = { link: url };
  if (options?.caption) mediaObject.caption = options.caption;
  if (type === "document" && options?.filename) mediaObject.filename = options.filename;

  const requestUrl = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      requestUrl,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type,
        [type]: mediaObject,
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
    console.log("WHATSAPP MEDIA API ERROR:", error?.response?.data || error.message);
    throw error;
  }
};

export interface WhatsAppTemplatePayload {
  name: string;
  language: string;
  variables?: string[];
  isCarousel?: boolean;
  cardBodyVariables?: string[][];
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

  const components: Record<string, unknown>[] = template.variables?.length
    ? [
        {
          type: "body",
          parameters: template.variables.map((v) => ({ type: "text", text: v })),
        },
      ]
    : [];

  if (template.isCarousel && template.cardBodyVariables?.length) {
    components.push({
      type: "carousel",
      cards: template.cardBodyVariables.map((vars, index) => ({
        card_index: index,
        components: vars.length
          ? [
              {
                type: "body",
                parameters: vars.map((v) => ({ type: "text", text: v })),
              },
            ]
          : [],
      })),
    });
  }

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

/**
 * Uploads an image to Meta's Resumable Upload API and returns the
 * `header_handle` needed as the `example` for a template's IMAGE header —
 * a public URL alone isn't accepted when creating templates with media.
 */
export const uploadMediaToMeta = async (
  appId: string,
  accessToken: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> => {
  const sessionRes = await axios.post(
    `https://graph.facebook.com/v25.0/${appId}/uploads`,
    null,
    {
      params: {
        file_length: buffer.length,
        file_type: mimeType,
        access_token: accessToken,
      },
    }
  );

  const uploadSessionId = sessionRes.data.id;

  const uploadRes = await axios.post(
    `https://graph.facebook.com/v25.0/${uploadSessionId}`,
    buffer,
    {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        "Content-Type": "application/octet-stream",
        file_offset: "0",
      },
    }
  );

  return uploadRes.data.h;
};

export interface CarouselCardPayload {
  imageHandle: string;
  bodyText: string;
  buttons: { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value?: string }[];
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  bodyText: string;
  cards: CarouselCardPayload[];
}

/**
 * Submits a carousel message template to Meta for review via
 * POST /{waba-id}/message_templates. Approval is async — Meta returns a
 * PENDING status immediately and reviews over the following hours/days.
 */
export const createWhatsAppCarouselTemplate = async (
  wabaId: string,
  accessToken: string,
  payload: CreateTemplatePayload
) => {
  const buttonComponent = (buttons: CarouselCardPayload["buttons"]) =>
    buttons.map((b) => ({
      type: b.type,
      text: b.text,
      ...(b.type === "URL" && { url: b.value }),
      ...(b.type === "PHONE_NUMBER" && { phone_number: b.value }),
    }));

  const cards = payload.cards.map((card) => ({
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: { header_handle: [card.imageHandle] },
      },
      { type: "BODY", text: card.bodyText },
      ...(card.buttons.length
        ? [{ type: "BUTTONS", buttons: buttonComponent(card.buttons) }]
        : []),
    ],
  }));

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/${wabaId}/message_templates`,
      {
        name: payload.name,
        language: payload.language,
        category: "MARKETING",
        components: [
          { type: "BODY", text: payload.bodyText },
          { type: "CAROUSEL", cards },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data as { id: string; status: string };
  } catch (error: any) {
    console.log("WHATSAPP CREATE TEMPLATE API ERROR:", error?.response?.data || error.message);
    throw error;
  }
};
