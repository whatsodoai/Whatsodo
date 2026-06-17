import KnowledgeBase from "../models/KnowledgeBase";

export const createKnowledgeBase =
async (data: any) => {
return await KnowledgeBase.create(
data
);
};

export const getKnowledgeBase = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};

export const getKnowledgeBaseByBusiness = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};
