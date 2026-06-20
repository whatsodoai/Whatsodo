import KnowledgeBase from "../models/KnowledgeBase";

export const createKnowledgeBase = async (data: any) => {
  const { businessId, ...rest } = data;
  return await KnowledgeBase.findOneAndUpdate(
    { businessId },
    { $set: rest },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const getKnowledgeBase = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};

export const getKnowledgeBaseByBusiness = async (businessId: string) => {
  return await KnowledgeBase.findOne({ businessId });
};
