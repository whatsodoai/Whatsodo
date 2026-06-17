import Lead from "../models/Lead";

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
