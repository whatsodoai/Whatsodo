import { Request, Response } from "express";
import {
  createAppointment,
  getAppointments,
} from "../services/appointment.service";
import Appointment from "../models/Appointment";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appointment = await createAppointment(req.body);

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create appointment",
    });
  }
};

export const clearAppointments = async (
  req: Request,
  res: Response
): Promise<void> => {
  await Appointment.deleteMany({});

  res.json({
    success: true,
    message: "All appointments cleared",
  });
};

export const getAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.params;

    const appointments = await getAppointments(businessId as string);

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch appointments",
    });
  }
};
