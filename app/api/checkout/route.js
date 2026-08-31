import { createCheckout } from "../../../lib/services/checkout-service";
import { handleJsonPost } from "../../../lib/services/http-service";

export async function POST(req) {
  return handleJsonPost(req, createCheckout);
}
