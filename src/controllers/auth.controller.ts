import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service";
import { generateToken } from "../utils/jwt";
import { AuthRequest } from "../middleware/auth.middleware";
import Business from "../models/Business";

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const user = await registerUser(name, email, password);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Registration failed",
    });
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await loginUser(email, password);

    const token = generateToken(
      user._id.toString(),
      user.email,
      user.role
    );

    const business = await Business.findOne({ ownerId: user._id }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      token,
      businessId: business?._id ?? null,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Login failed",
    });
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};