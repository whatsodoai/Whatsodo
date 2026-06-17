import axios from "axios";
import https from "https";

export const sendWhatsAppMessage = async (
  to: string,
  message: string
) => {
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
      to,
      type: "text",
      text: {
        body: message,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
  );

  return response.data;
};