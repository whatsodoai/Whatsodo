import Message from "../models/Message";

export interface MessageMedia {
  mediaType: "image" | "video" | "document";
  mediaUrl: string;
  mediaCaption?: string;
  fileName?: string;
}

export const saveMessage = async (
  businessId: string,
  phone: string,
  direction: "incoming" | "outgoing",
  message: string,
  wamid?: string,
  media?: MessageMedia
) => {
  console.log("MESSAGE SAVED:", direction, message);

  return Message.create({
    businessId,
    phone,
    direction,
    message,
    isRead: direction === "outgoing",
    wamid,
    ...media,
  });
};

export const isDuplicateWamid = async (wamid: string): Promise<boolean> => {
  const existing = await Message.findOne({ wamid }).lean();
  return existing !== null;
};

export const markConversationRead = async (
  businessId: string,
  phone: string
) => {
  return Message.updateMany(
    { businessId, phone, direction: "incoming", isRead: false },
    { $set: { isRead: true } }
  );
};

export const getConversation = async (
  businessId: string,
  phone: string
) => {
  return Message.find({
    businessId,
    phone,
  }).sort({
    createdAt: 1,
  });
};