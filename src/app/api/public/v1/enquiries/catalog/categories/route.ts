import { jsonData, jsonError } from "@/lib/api";
import { getPublicEnquiryCategories } from "@/modules/leads/public-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = jsonData({ categories: await getPublicEnquiryCategories() });
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
