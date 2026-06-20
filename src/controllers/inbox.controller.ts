import { Request, Response } from "express";
import Message from "../models/Message";
import Lead from "../models/Lead";

export const getInbox = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const threads = await Message.aggregate([
      { $match: { businessId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$phone",
          phone: { $first: "$phone" },
          lastMessage: { $first: "$message" },
          lastMessageTime: { $first: "$createdAt" },
          direction: { $first: "$direction" },
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    // enrich with lead name
    const phones = threads.map((t) => t.phone);
    const leads = await Lead.find({ businessId, phone: { $in: phones } }).select("phone name").lean();
    const leadMap: Record<string, string> = {};
    for (const l of leads) {
      leadMap[l.phone] = l.name;
    }

    // Count unread per thread
    const unreadCounts = await Message.aggregate([
      { $match: { businessId, phone: { $in: phones }, direction: "incoming", isRead: false } },
      { $group: { _id: "$phone", count: { $sum: 1 } } },
    ]);
    const unreadMap: Record<string, number> = {};
    for (const u of unreadCounts) unreadMap[u._id] = u.count;

    const inbox = threads.map((t) => ({
      phone: t.phone,
      leadName: leadMap[t.phone] || null,
      lastMessage: t.lastMessage,
      lastMessageTime: t.lastMessageTime,
      direction: t.direction,
      unread: (unreadMap[t.phone] ?? 0) > 0,
      unreadCount: unreadMap[t.phone] ?? 0,
    }));

    res.json({ success: true, data: inbox });
  } catch {
    res.status(500).json({ success: false });
  }
};
