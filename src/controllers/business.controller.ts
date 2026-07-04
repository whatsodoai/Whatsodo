import { Response } from "express";
import axios from "axios";
import { AuthRequest } from "../middleware/auth.middleware";
import { createBusiness, getBusinesses } from "../services/business.service";
import { isBusinessOwner, hasBusinessAccess } from "../utils/ownership";
import { uploadMediaToMeta, createWhatsAppCarouselTemplate } from "../services/whatsapp.service";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  getPhoneNumberDetails,
  getMetaUserId,
  verifyCoexistenceOnboarding,
  initiateContactsSync,
  initiateHistorySync,
  subscribeCoexistenceWebhooks,
} from "../services/meta-embedded-signup.service";
import { env } from "../config/env";
import Business from "../models/Business";
import User from "../models/User";

const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, "-");

export const getWhatsAppDefaults = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessId } = req.query;

    if (!businessId || typeof businessId !== "string") {
      res.status(400).json({ success: false, message: "businessId is required" });
      return;
    }
    if (!(await isBusinessOwner(req.user!.userId, businessId))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(businessId).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        webhookUrl: `https://whatsodo.onrender.com/api/webhook/${slugify(business.businessName)}`,
        verifyToken: business.whatsappVerifyToken || "",
        phoneNumberId: business.whatsappPhoneNumberId || "",
        hasAccessToken: !!business.whatsappAccessToken,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp defaults",
    });
  }
};

export const create = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { businessName, industry, whatsappNumber } = req.body;

    const business = await createBusiness(
      req.user!.userId,
      businessName,
      industry,
      whatsappNumber
    );

    res.status(201).json({
      success: true,
      data: business,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create business",
    });
  }
};

export const getAll = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const businesses = await getBusinesses(req.user!.userId);

    res.status(200).json({
      success: true,
      data: businesses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch businesses",
    });
  }
};

export const update = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      businessName,
      industry,
      whatsappNumber,
      timezone,
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappVerifyToken,
      whatsappBusinessAccountId,
      whatsappAppId,
    } = req.body;

    const business = await Business.findOneAndUpdate(
      { _id: id, ownerId: req.user!.userId },
      {
        ...(businessName && { businessName }),
        ...(industry && { industry }),
        ...(whatsappNumber && { whatsappNumber }),
        ...(timezone && { timezone }),
        ...(whatsappAccessToken !== undefined && { whatsappAccessToken }),
        ...(whatsappPhoneNumberId !== undefined && { whatsappPhoneNumberId }),
        ...(whatsappVerifyToken !== undefined && { whatsappVerifyToken }),
        ...(whatsappBusinessAccountId !== undefined && { whatsappBusinessAccountId }),
        ...(whatsappAppId !== undefined && { whatsappAppId }),
      },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update business",
    });
  }
};

/**
 * Completes the WhatsApp Embedded Signup flow. Supports two modes:
 * - isCoexistence=true: links an existing WhatsApp Business App number
 *   (keeps it active in the app while enabling Cloud API simultaneously).
 * - isCoexistence=false (default): standard Cloud API number registration.
 *
 * For coexistence mode, also subscribes to the extra webhook fields required
 * by Meta (history, smb_app_state_sync, smb_message_echoes) and kicks off
 * contacts + history sync immediately after onboarding.
 */
export const connectWhatsAppEmbedded = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, wabaId, phoneNumberId, isCoexistence = false } = req.body;

    if (!code || !wabaId || !phoneNumberId) {
      res.status(400).json({
        success: false,
        message: "code, wabaId and phoneNumberId are required",
      });
      return;
    }

    const accessToken = await exchangeCodeForToken(code);

    // For coexistence, subscribe to extra webhook fields before anything else
    if (isCoexistence) {
      subscribeCoexistenceWebhooks(wabaId, accessToken).catch((err) =>
        console.error("Failed to subscribe coexistence webhooks:", err?.response?.data || err.message)
      );
    } else {
      subscribeAppToWaba(wabaId, accessToken).catch((err) =>
        console.error("Failed to subscribe app to WABA:", err?.response?.data || err.message)
      );
    }

    const [phoneDetails, metaUserId] = await Promise.all([
      getPhoneNumberDetails(phoneNumberId, accessToken).catch((err) => {
        console.error("Failed to fetch phone number details:", err?.response?.data || err.message);
        return null;
      }),
      getMetaUserId(accessToken),
    ]);

    const coexistenceUpdate = isCoexistence
      ? {
          isCoexistence: true,
          coexistenceStatus: "connected" as const,
          historyImported: false,
          contactsSynced: false,
          lastSyncAt: new Date(),
        }
      : { isCoexistence: false };

    const business = await Business.findOneAndUpdate(
      { _id: id, ownerId: req.user!.userId },
      {
        whatsappAccessToken: accessToken,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappBusinessAccountId: wabaId,
        whatsappAppId: env.META_APP_ID,
        whatsappConnectedAt: new Date(),
        ...(metaUserId && { metaUserId }),
        ...(phoneDetails?.display_phone_number && {
          whatsappNumber: phoneDetails.display_phone_number,
        }),
        ...coexistenceUpdate,
      },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    // For coexistence: verify the link succeeded then kick off background syncs.
    // These are fire-and-forget — the initial connect succeeds regardless.
    if (isCoexistence) {
      verifyCoexistenceOnboarding(phoneNumberId, accessToken)
        .then(({ isOnBizApp, isCloudApi }) => {
          if (!isOnBizApp || !isCloudApi) {
            console.warn(`Coexistence verification incomplete for ${phoneNumberId}: is_on_biz_app=${isOnBizApp} platform_type_is_cloud=${isCloudApi}`);
          }
        })
        .catch((err) => console.error("Coexistence verification error:", err));

      // Kick off contact and history syncs; webhooks will notify us as data arrives
      initiateContactsSync(phoneNumberId, accessToken)
        .then(() =>
          Business.findByIdAndUpdate(id, { coexistenceStatus: "syncing" })
        )
        .catch((err) => console.error("Contacts sync initiation failed:", err));

      initiateHistorySync(phoneNumberId, accessToken).catch((err) =>
        console.error("History sync initiation failed:", err)
      );
    }

    res.json({ success: true, data: business });
  } catch (error: any) {
    console.error("Embedded signup connect failed:", error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to connect WhatsApp account. Please try again.",
    });
  }
};

/**
 * Returns the current WhatsApp connection health for a business,
 * including coexistence mode details.
 */
export const getConnectionHealth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await hasBusinessAccess(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(id).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        connected: !!business.whatsappAccessToken,
        mode: business.isCoexistence ? "coexistence" : "cloud_api",
        coexistenceStatus: business.coexistenceStatus ?? null,
        historyImported: business.historyImported ?? false,
        contactsSynced: business.contactsSynced ?? false,
        lastSyncAt: business.lastSyncAt ?? null,
        disconnectReason: business.disconnectReason ?? null,
        messagingLimit: business.messagingLimit ?? null,
        qualityRating: business.qualityRating ?? null,
        phoneNumber: business.whatsappNumber,
        connectedAt: business.whatsappConnectedAt ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch connection health" });
  }
};

/**
 * Manually triggers a contacts re-sync from the WhatsApp Business App.
 */
export const triggerContactsSync = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findById(id).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }
    if (!business.isCoexistence || !business.whatsappPhoneNumberId || !business.whatsappAccessToken) {
      res.status(400).json({ success: false, message: "Coexistence mode not active for this business" });
      return;
    }

    const requestId = await initiateContactsSync(
      business.whatsappPhoneNumberId,
      business.whatsappAccessToken
    );

    if (requestId) {
      await Business.findByIdAndUpdate(id, { coexistenceStatus: "syncing", lastSyncAt: new Date() });
    }

    res.json({ success: true, data: { requestId } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to trigger contacts sync" });
  }
};

/**
 * Manually triggers a history re-sync from the WhatsApp Business App.
 */
export const triggerHistorySync = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findById(id).lean();
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }
    if (!business.isCoexistence || !business.whatsappPhoneNumberId || !business.whatsappAccessToken) {
      res.status(400).json({ success: false, message: "Coexistence mode not active for this business" });
      return;
    }

    const requestId = await initiateHistorySync(
      business.whatsappPhoneNumberId,
      business.whatsappAccessToken
    );

    res.json({ success: true, data: { requestId } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to trigger history sync" });
  }
};

export const getOne = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!(await hasBusinessAccess(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Not authorized for this business" });
      return;
    }

    const business = await Business.findById(id)
      .populate("members.userId", "name email")
      .populate("ownerId", "name email")
      .lean();

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch business",
    });
  }
};

export const addMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) {
      res.status(404).json({
        success: false,
        message: "No Whatsodo account found with that email — ask them to sign up first, then invite again.",
      });
      return;
    }

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    if (business.ownerId.toString() === user._id.toString()) {
      res.status(400).json({ success: false, message: "This user already owns the business" });
      return;
    }
    if (business.members.some((m) => m.userId.toString() === user._id.toString())) {
      res.status(400).json({ success: false, message: "This user is already a member" });
      return;
    }

    business.members.push({
      userId: user._id as any,
      role: role === "admin" ? "admin" : "agent",
      addedAt: new Date(),
    });
    await business.save();

    res.status(201).json({
      success: true,
      data: { userId: user._id, name: user.name, email: user.email, role: role === "admin" ? "admin" : "agent" },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add member",
    });
  }
};

export const removeMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, userId } = req.params;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findByIdAndUpdate(
      id,
      { $pull: { members: { userId } } },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove member",
    });
  }
};

export const addTemplate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, language, bodyPreview, variableCount } = req.body;

    if (!name || !language) {
      res.status(400).json({ success: false, message: "name and language are required" });
      return;
    }
    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findByIdAndUpdate(
      id,
      {
        $push: {
          whatsappTemplates: {
            name,
            language,
            bodyPreview: bodyPreview || "",
            variableCount: variableCount || 0,
            createdAt: new Date(),
            type: "standard",
          },
        },
      },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.status(201).json({ success: true, data: business.whatsappTemplates });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to add template",
    });
  }
};

export const addCarouselTemplate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, language, bodyText, cards } = req.body;

    if (!name || !language || !bodyText || !Array.isArray(cards) || cards.length === 0) {
      res.status(400).json({
        success: false,
        message: "name, language, bodyText and at least one card are required",
      });
      return;
    }

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findById(id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    const wabaId = business.whatsappBusinessAccountId;
    const appId = business.whatsappAppId;
    const accessToken = business.whatsappAccessToken;

    if (!wabaId || !appId || !accessToken) {
      res.status(400).json({
        success: false,
        message: "WhatsApp Business Account ID, App ID and access token must be configured in Settings first",
      });
      return;
    }

    const cardPayloads = await Promise.all(
      cards.map(async (card: { imageUrl: string; bodyText: string; buttons?: { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value?: string }[] }) => {
        const imageRes = await axios.get(card.imageUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(imageRes.data);
        const mimeType = String(imageRes.headers["content-type"] || "image/jpeg");
        const imageHandle = await uploadMediaToMeta(appId, accessToken, buffer, mimeType);

        return {
          imageHandle,
          bodyText: card.bodyText,
          buttons: card.buttons || [],
        };
      })
    );

    const metaResult = await createWhatsAppCarouselTemplate(wabaId, accessToken, {
      name,
      language,
      bodyText,
      cards: cardPayloads,
    });

    business.whatsappTemplates.push({
      name,
      language,
      bodyPreview: bodyText,
      variableCount: 0,
      createdAt: new Date(),
      type: "carousel",
      status: (metaResult.status as "PENDING" | "APPROVED" | "REJECTED") || "PENDING",
      metaTemplateId: metaResult.id,
      cards: cards.map((card: { imageUrl: string; bodyText: string; buttons?: any[] }) => ({
        imageUrl: card.imageUrl,
        bodyText: card.bodyText,
        buttons: card.buttons || [],
      })),
    });
    await business.save();

    res.status(201).json({ success: true, data: business.whatsappTemplates });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.response?.data?.error?.message || (error instanceof Error ? error.message : "Failed to create carousel template"),
    });
  }
};

export const removeTemplate = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, templateName } = req.params;

    if (!(await isBusinessOwner(req.user!.userId, id as string))) {
      res.status(403).json({ success: false, message: "Only the business owner can do this" });
      return;
    }

    const business = await Business.findByIdAndUpdate(
      id,
      { $pull: { whatsappTemplates: { name: templateName } } },
      { new: true }
    );

    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    res.json({ success: true, data: business.whatsappTemplates });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to remove template",
    });
  }
};
