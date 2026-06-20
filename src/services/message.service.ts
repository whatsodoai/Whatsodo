import Message from "../models/Message";

export const saveMessage = async (
  businessId: string,
  phone: string,
  direction: "incoming" | "outgoing",
  message: string
) => {
  console.log("MESSAGE SAVED:", direction, message);

  return Message.create({
    businessId,
    phone,
    direction,
    message,
    isRead: direction === "outgoing",
  });
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