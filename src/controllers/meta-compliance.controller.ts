import { Request, Response } from "express";
import crypto from "crypto";
import { verifySignedRequest } from "../utils/meta-signed-request";
import { env } from "../config/env";
import Business from "../models/Business";

const STATUS_BASE_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Public endpoint — returns the Meta App ID and Embedded Signup Config ID
 * so the frontend can initialize the FB SDK without needing NEXT_PUBLIC_
 * environment variables set in every deployment target.
 */
export const getAppConfig = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      appId: env.META_APP_ID,
      configId: env.META_CONFIG_ID,
    },
  });
};

/**
 * Meta calls this when a business owner revokes Whatsodo's access from
 * their Facebook settings (not via our own UI). We can't disconnect a
 * specific Business by FB user_id alone if one Meta account owns several,
 * so this clears WhatsApp credentials on every Business linked to that
 * FB user — leaving the Business record itself intact for them to
 * reconnect later.
 */
export const deauthorizeCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const signedRequest = req.body?.signed_request;
  const decoded = signedRequest ? verifySignedRequest(signedRequest) : null;

  if (!decoded) {
    res.sendStatus(400);
    return;
  }

  await Business.updateMany(
    { metaUserId: decoded.user_id },
    {
      $unset: {
        whatsappAccessToken: "",
        whatsappPhoneNumberId: "",
        whatsappBusinessAccountId: "",
      },
      $set: { whatsappDeauthorizedAt: new Date() },
    }
  );

  res.sendStatus(200);
};

/**
 * Meta calls this when a user requests their data be deleted via Facebook's
 * "Apps and Websites" settings. Per Meta's spec we must respond with a JSON
 * body containing a status-check URL and confirmation code, then actually
 * delete the data identified by that confirmation code asynchronously.
 */
export const dataDeletionCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const signedRequest = req.body?.signed_request;
  const decoded = signedRequest ? verifySignedRequest(signedRequest) : null;

  if (!decoded) {
    res.sendStatus(400);
    return;
  }

  const confirmationCode = crypto.randomUUID();

  // Best-effort, synchronous deletion — small per-business document counts
  // make this fast enough to finish before Meta's response timeout.
  Business.deleteMany({ metaUserId: decoded.user_id }).catch((err) =>
    console.error("Data deletion failed for", decoded.user_id, err)
  );

  res.json({
    url: `${STATUS_BASE_URL}/data-deletion-status/${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
};
