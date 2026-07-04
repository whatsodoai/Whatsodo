import { Request, Response } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
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
    res.status(201).json({ success: true, data: knowledgeBase });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create knowledge base",
    });
  }
};

export const getByBusiness = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const knowledgeBase = await getKnowledgeBase(req.params.businessId as string);
    res.status(200).json({ success: true, data: knowledgeBase });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch knowledge base",
    });
  }
};

/**
 * Extracts readable text from an uploaded PDF file.
 * Expects multipart/form-data with a 'file' field (PDF buffer).
 */
export const extractPdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ success: false, message: "No PDF file uploaded" });
      return;
    }

    const data = await pdfParse(file.buffer);
    const text = data.text
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000); // cap to avoid token overflow

    res.status(200).json({ success: true, data: { text, pages: data.numpages } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to extract PDF text",
    });
  }
};

/**
 * Scrapes visible text content from a given URL for knowledge base training.
 * Strips scripts, styles, and nav/footer boilerplate.
 */
export const extractWebsite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      res.status(400).json({ success: false, message: "url is required" });
      return;
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Whatsodo/1.0)" },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Remove noise elements
    $("script, style, nav, footer, header, noscript, iframe, svg, form, button").remove();

    const text = $("body")
      .text()
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);

    const title = $("title").text().trim();

    res.status(200).json({ success: true, data: { text, title, url } });
  } catch (error: any) {
    const msg =
      error?.response?.status
        ? `Could not fetch URL (HTTP ${error.response.status})`
        : error instanceof Error
        ? error.message
        : "Failed to extract website content";
    res.status(500).json({ success: false, message: msg });
  }
};
