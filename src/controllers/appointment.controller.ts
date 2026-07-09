import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  createAppointment,
  getAppointments,
  rescheduleAppointment,
} from "../services/appointment.service";
import { hasBusinessAccess } from "../utils/ownership";
import Appointment from "../models/Appointment";
import { getIO } from "../socket";

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const appointment = await createAppointment(req.body);

    try {
      getIO().to(`business:${req.body.businessId}`).emit("appointment:booked", {
        date: req.body.date,
        time: req.body.time,
        appointment,
      });
    } catch { /* socket may not be ready in tests */ }

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create appointment";
    res.status(msg.includes("already booked") ? 409 : 500).json({ success: false, message: msg });
  }
};

export const getCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;

    const appointments = await Appointment.find({ businessId })
      .populate<{ leadId: { name: string } }>("leadId", "name")
      .lean();

    const events = appointments.map((a) => {
      const leadName =
        a.leadId && typeof a.leadId === "object" && "name" in a.leadId
          ? (a.leadId as { name: string }).name
          : "Consultation";
      const [hour, min] = a.time.split(":").map(Number);
      const start = new Date(`${a.date}T${String(hour).padStart(2, "0")}:${String(min || 0).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return {
        id: (a._id as any).toString(),
        title: `${leadName} — ${a.status}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: a.status,
        notes: a.notes,
      };
    });

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch calendar",
    });
  }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;
    const appointments = await getAppointments(businessId as string);
    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch appointments",
    });
  }
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const existing = await Appointment.findById(id as string);
    if (!existing) {
      res.status(404).json({ success: false, message: "Appointment not found" });
      return;
    }
    if (!(await hasBusinessAccess(req.user!.userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, businessId: existing.businessId },
      { ...(status && { status }), ...(notes !== undefined && { notes }) },
      { new: true }
    ).populate("leadId", "name phone");

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update appointment",
    });
  }
};

export const reschedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

    if (!date || !time) {
      res.status(400).json({ success: false, message: "date and time are required" });
      return;
    }

    const existing = await Appointment.findById(id as string);
    if (!existing) {
      res.status(404).json({ success: false, message: "Appointment not found" });
      return;
    }
    if (!(await hasBusinessAccess(req.user!.userId, existing.businessId.toString()))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const appointment = await rescheduleAppointment(id as string, date, time);

    try {
      getIO().to(`business:${existing.businessId.toString()}`).emit("appointment:rescheduled", {
        id,
        date,
        time,
        appointment,
      });
    } catch { /* socket may not be ready */ }

    res.json({ success: true, data: appointment });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to reschedule appointment";
    res.status(msg.includes("already taken") ? 409 : 500).json({ success: false, message: msg });
  }
};
