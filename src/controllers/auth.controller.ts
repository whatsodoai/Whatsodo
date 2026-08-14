import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { registerUser, loginUser } from "../services/auth.service";
import { generateToken } from "../utils/jwt";
import { AuthRequest } from "../middleware/auth.middleware";
import Business from "../models/Business";
import User from "../models/User";

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const user = await registerUser(name, email, password);

    const token = generateToken(
      user._id.toString(),
      user.email,
      user.role
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      businessId: null,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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

export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, password } = req.body;
    const update: Record<string, string> = {};

    if (name?.trim()) update.name = name.trim();
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        return;
      }
      update.password = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(update).length) {
      res.status(400).json({ success: false, message: "Nothing to update" });
      return;
    }

    const user = await User.findByIdAndUpdate(req.user!.userId, update, { new: true }).lean();
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};