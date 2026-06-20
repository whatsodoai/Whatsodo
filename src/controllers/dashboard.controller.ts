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

    const appointmentBooked = await Lead.countDocuments({
      businessId,
      status: 'Appointment Booked',
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contacted: contactedLeads,
        qualified: qualifiedLeads,
        won: wonLeads,
        lost: lostLeads,
        totalAppointments: appointments,
        appointmentBooked,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Dashboard error",
    });
  }
};