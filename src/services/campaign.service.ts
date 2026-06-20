import pLimit from "p-limit";
import Campaign from "../models/Campaign";
import CampaignRecipient from "../models/CampaignRecipient";
import Lead from "../models/Lead";
import Business from "../models/Business";
import { saveMessage } from "./message.service";
import { sendWhatsAppTemplate } from "./whatsapp.service";

interface CreateCampaignInput {
  businessId: string;
  templateName: string;
  language: string;
  leadIds?: string[];
  filter?: { status?: string; source?: string; intentTag?: string };
  variables?: string[];
}

export const createCampaign = async (input: CreateCampaignInput) => {
  const { businessId, templateName, language, leadIds, filter, variables } = input;

  const leads = leadIds?.length
    ? await Lead.find({ businessId, _id: { $in: leadIds } })
    : await Lead.find({ businessId, ...(filter || {}) } as Record<string, unknown>);

  if (leads.length === 0) {
    throw new Error("No leads matched — nothing to send");
  }

  const campaign = await Campaign.create({
    businessId,
    templateName,
    language,
    segment: leadIds?.length ? { leadIds } : filter || {},
    status: "draft",
    stats: { total: leads.length, sent: 0, failed: 0 },
  });

  await CampaignRecipient.insertMany(
    leads.map((lead) => ({
      campaignId: campaign._id,
      leadId: lead._id,
      phone: lead.phone,
      status: "pending" as const,
    }))
  );

  runCampaign(campaign._id.toString(), variables).catch((err) =>
    console.error("Campaign run failed:", err)
  );

  return campaign;
};

const RATE_LIMIT_CONCURRENCY = 3;
const DELAY_BETWEEN_SENDS_MS = 350; // keeps well under Meta's per-second tier limits

export const runCampaign = async (campaignId: string, variables?: string[]) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  const business = await Business.findById(campaign.businessId).lean();
  if (!business) {
    campaign.status = "failed";
    await campaign.save();
    return;
  }

  const waCreds = {
    accessToken: business.whatsappAccessToken,
    phoneNumberId: business.whatsappPhoneNumberId,
  };

  campaign.status = "sending";
  await campaign.save();

  const recipients = await CampaignRecipient.find({ campaignId, status: "pending" });
  const limit = pLimit(RATE_LIMIT_CONCURRENCY);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    recipients.map((recipient, i) =>
      limit(async () => {
        await new Promise((r) => setTimeout(r, i * DELAY_BETWEEN_SENDS_MS));
        try {
          await sendWhatsAppTemplate(
            recipient.phone,
            { name: campaign.templateName, language: campaign.language, variables },
            waCreds
          );
          recipient.status = "sent";
          recipient.sentAt = new Date();
          sent++;
          await saveMessage(
            campaign.businessId.toString(),
            recipient.phone,
            "outgoing",
            `[Template: ${campaign.templateName}]`
          );
        } catch (error: any) {
          recipient.status = "failed";
          recipient.error = error?.response?.data?.error?.message || error.message;
          failed++;
        }
        await recipient.save();
      })
    )
  );

  campaign.stats.sent = sent;
  campaign.stats.failed = failed;
  campaign.status = failed === recipients.length ? "failed" : "completed";
  await campaign.save();
};

export const getCampaigns = async (businessId: string) => {
  return Campaign.find({ businessId }).sort({ createdAt: -1 });
};

export const getCampaignDetail = async (campaignId: string) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return null;
  const recipients = await CampaignRecipient.find({ campaignId }).populate("leadId", "name phone");
  return { campaign, recipients };
};
