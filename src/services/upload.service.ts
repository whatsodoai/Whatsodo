import cloudinary from "../config/cloudinary";

export interface UploadResult {
  url: string;
  bytes: number;
  mimeType: string;
}

const RESOURCE_TYPE_BY_MIME: Record<string, "image" | "video" | "raw"> = {
  image: "image",
  video: "video",
  application: "raw",
};

export const uploadBuffer = (
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> => {
  const resourceType = RESOURCE_TYPE_BY_MIME[mimeType.split("/")[0]] || "raw";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: "whatsodo" },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          url: result.secure_url,
          bytes: result.bytes,
          mimeType,
        });
      }
    );
    stream.end(buffer);
  });
};
