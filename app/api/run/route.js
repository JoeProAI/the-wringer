import { runAudit } from "../../../lib/services/audit-service";
import { handleJsonPost } from "../../../lib/services/http-service";

export async function POST(req) {
  return handleJsonPost(req, runAudit, { paymentCookie: true });
}

export const maxDuration = 60;
