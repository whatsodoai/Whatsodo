import Message from "../models/Message";

export const saveMessage = async (
  businessId: string,
  phone: string,
  direction: "incoming" | "outgoing",
  message: string
) => {
  return Message.create({
    businessId,
    phone,
    direction,
    message,
  });
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