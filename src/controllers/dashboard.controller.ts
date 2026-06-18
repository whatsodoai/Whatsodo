import { Request, Response } from "express";
import Lead from "../models/Lead";
import Appointment from "../models/Appointment";

export const getSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const totalLeads = await Lead.countDocuments({
      businessId,
    });

    const newLeads = await Lead.countDocuments({
      businessId,
      status: "New Lead",
    });

    const contactedLeads =
      await Lead.countDocuments({
        businessId,
        status: "Contacted",
      });

    const qualifiedLeads =
      await Lead.countDocuments({
        businessId,
        status: "Qualified",
      });

    const wonLeads =
      await Lead.countDocuments({
        businessId,
        status: "Won",
      });

    const lostLeads =
      await Lead.countDocuments({
        businessId,
        status: "Lost",
      });

    const appointments =
      await Appointment.countDocuments({
        businessId,
      });

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contactedLeads,
        qualifiedLeads,
        wonLeads,
        lostLeads,
        appointments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Dashboard error",
    });
  }
};