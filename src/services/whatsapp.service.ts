import axios from "axios";

export const sendWhatsAppMessage = async (
  to: string,
  message: string
) => {
  try {
    const phoneNumberId =
      process.env.WHATSAPP_PHONE_NUMBER_ID;

    const accessToken =
      process.env.WHATSAPP_ACCESS_TOKEN;

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
