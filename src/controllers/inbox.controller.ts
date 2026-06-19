import { Request, Response } from "express";
import Message from "../models/Message";

export const getInbox = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const messages = await Message.aggregate([
      {
        $match: {
          businessId,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: "$phone",
          phone: {
            $first: "$phone",
          },
          lastMessage: {
            $first: "$message",
          },
          lastMessageAt: {
            $first: "$createdAt",
          },
        },
      },
      {
        $sort: {
          lastMessageAt: -1,
        },
      },
    ]);

    res.json({
      success: true,
      data: messages,
    });
  } catch {
    res.status(500).json({
      success: false,
    });
  }
};
