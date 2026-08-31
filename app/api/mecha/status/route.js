import { handleJsonPost } from "../../../../lib/services/http-service";
import { getMechaStatus } from "../../../../lib/services/mecha-service";

export async function POST(req) {
  return handleJsonPost(req, getMechaStatus, { paymentCookie: true });
}

export const maxDuration = 60;
