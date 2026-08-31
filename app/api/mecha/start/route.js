import { handleJsonPost } from "../../../../lib/services/http-service";
import { startMecha } from "../../../../lib/services/mecha-service";

export async function POST(req) {
  return handleJsonPost(req, startMecha, { paymentCookie: true });
}

export const maxDuration = 60;
