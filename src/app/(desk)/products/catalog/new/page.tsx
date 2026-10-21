import { redirect } from "next/navigation";

export default function LegacyNewCatalogProductPage() {
  redirect("/products/new");
}
