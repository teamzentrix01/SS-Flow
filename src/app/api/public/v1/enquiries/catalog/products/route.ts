import { NextResponse } from "next/server";
import { jsonData, jsonError } from "@/lib/api";
import { getPublicEnquiryProductList } from "@/modules/leads/public-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const query = (search.get("q") ?? "").trim();
    const page = Number(search.get("page") ?? "1");
    if (query.length > 80 || !Number.isInteger(page) || page < 1 || page > 100) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid product search." } }, { status: 400 });
    }
    const response = jsonData(await getPublicEnquiryProductList(query, page));
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
