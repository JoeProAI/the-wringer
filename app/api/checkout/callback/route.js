import { completeCheckoutCallback } from "../../../../lib/services/checkout-callback-service";
import { errorResponse } from "../../../../lib/services/http-service";

export async function GET(req) {
  try {
    return await completeCheckoutCallback(req);
  } catch (error) {
    return errorResponse(error);
  }
}
