import { Daytona } from "@daytonaio/sdk";

export function getDaytona() {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY not configured");
  }
  return new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    target: process.env.DAYTONA_TARGET || "us",
  });
}
