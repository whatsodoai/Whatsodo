export const env = {
    PORT: process.env.PORT || "5000",
    MONGODB_URI: process.env.MONGODB_URI || "",
    META_APP_ID: process.env.META_APP_ID || "",
    META_APP_SECRET: process.env.META_APP_SECRET || "",
    META_CONFIG_ID: process.env.META_CONFIG_ID || "",
  };

  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }