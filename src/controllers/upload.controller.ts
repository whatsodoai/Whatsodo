import { Request, Response } from "express";
import { uploadBuffer } from "../services/upload.service";

export const upload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "file is required" });
      return;
    }

    const result = await uploadBuffer(req.file.buffer, req.file.mimetype);
    res.json({ success: true, data: { url: result.url } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to upload file",
    });
  }
};
