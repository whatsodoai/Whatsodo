import { Request, Response } from "express";
import {
  createKnowledgeBase,
  getKnowledgeBase,
} from "../services/knowledge-base.service";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const knowledgeBase = await createKnowledgeBase(req.body);

    res.status(201).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create knowledge base",
    });
  }
};

export const getByBusiness = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const knowledgeBase = await getKnowledgeBase(req.params.businessId as string);

    res.status(200).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch knowledge base",
    });
  }
};
