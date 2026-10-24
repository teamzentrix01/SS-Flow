/** Marketing-site contact form → SS-Flow lead payload. */

export type SiteEnquiryInput = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  product_interest?: string;
  message?: string;
  website?: string;
  address?: string;
  requiredDeliveryDate?: string;
  commercialRemarks?: string;
};

export function siteEnquiryToLeadInput(input: SiteEnquiryInput) {
  const customerName = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const product = String(input.product_interest ?? "").trim();
  const message = String(input.message ?? "").trim();
  const parts = [product, message].filter(Boolean);
  const itemDescription = parts.join("\n\n").slice(0, 500) || undefined;

  return {
    customerName,
    phone,
    email: String(input.email ?? "").trim() || undefined,
    companyName: String(input.company ?? "").trim() || undefined,
    address: String(input.address ?? "").trim() || undefined,
    requiredDeliveryDate: String(input.requiredDeliveryDate ?? "").trim() || undefined,
    commercialRemarks: String(input.commercialRemarks ?? "").trim() || undefined,
    itemDescription,
    honeypot: String(input.website ?? "").trim() || undefined,
  };
}
