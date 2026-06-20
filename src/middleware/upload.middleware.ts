import multer from "multer";

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf"];

export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.mimetype.startsWith(prefix)
    );
    if (!allowed) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
}).single("file");
