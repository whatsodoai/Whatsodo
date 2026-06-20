import { Request, Response } from "express";
import Lead from "../models/Lead";
import Appointment from "../models/Appointment";

export const getAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const [
      totalLeads,
      wonLeads,
      appointments,
      sourceAgg,
      statusAgg,
    ] = await Promise.all([
      Lead.countDocuments({ businessId }),
      Lead.countDocuments({ businessId, status: "Won" }),
      Appointment.countDocuments({ businessId }),
      Lead.aggregate([
        { $match: { businessId } },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { businessId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const leadSources: Record<string, number> = {};
    for (const s of sourceAgg) leadSources[s._id ?? "Unknown"] = s.count;

    const leadsByStatus: Record<string, number> = {};
    for (const s of statusAgg) leadsByStatus[s._id ?? "Unknown"] = s.count;

    const conversionRate =
      totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100 * 10) / 10 : 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        wonLeads,
        conversionRate,
        appointments,
        leadSources,
        leadsByStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Analytics error",
    });
  }
};
