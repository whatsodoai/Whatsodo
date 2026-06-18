import Lead from "../models/Lead";

export class LeadService {
  async createLead(data: any) {
    return await Lead.create(data);
  }

  async getLeads(businessId: string) {
    return await Lead.find({ businessId }).sort({ createdAt: -1 });
  }
}

export const createLead = async (
data: any
) => {
return await Lead.create(data);
};

export const getLeads = async (
  businessId: string
) => {
  return await Lead.find({
    businessId,
  }).sort({
    createdAt: -1,
  });
};

export const findLeadByPhone = async (
  businessId: string,
  phone: string
) => {
  return Lead.findOne({
    businessId,
    phone,
  });
};

export const updateLeadInterest = async (
  leadId: string,
  interest: string
) => {
  return Lead.findByIdAndUpdate(
    leadId,
    {
      interest,
      updatedAt: new Date(),
    },
    { new: true }
  );
};
