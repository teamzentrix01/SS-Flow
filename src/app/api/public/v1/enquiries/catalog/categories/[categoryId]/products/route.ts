import { NextResponse } from "next/server";
import { jsonData, jsonError } from "@/lib/api";
import { getPublicEnquiryProducts, publicCategoryIdIsValid } from "@/modules/leads/public-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const { categoryId } = await params;
    if (!publicCategoryIdIsValid(categoryId)) return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid category." } }, { status: 400 });
    const search = new URL(request.url).searchParams;
    const query = (search.get("q") ?? "").trim();
    const pageValue = Number(search.get("page") ?? "1");
    if (query.length > 80 || !Number.isInteger(pageValue) || pageValue < 1 || pageValue > 100) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "Invalid product search." } }, { status: 400 });
    }
    const response = jsonData(await getPublicEnquiryProducts(categoryId, query, pageValue));
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
