import type { quotationDetail } from "@/modules/leads/quotations/queries";
import { quotationLinePresentation } from "@/modules/leads/quotations/line-description";

type Quote = NonNullable<Awaited<ReturnType<typeof quotationDetail>>>;

export type QuotationRenderOptions = {
  archived?: boolean;
  sentAt?: Date;
  sentVia?: string | null;
};

export function quotationDocumentFilename(quotationNumber: string, version: number) {
  const safe = quotationNumber.replace(/[^\w-]+/g, "-");
  return `${safe}-v${version}.html`;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN");
}

function formatInr(value: string | { toString(): string }) {
  const n = Number(value.toString());
  if (!Number.isFinite(n)) return escapeHtml(value.toString());
  return escapeHtml(
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
}

export function renderQuotationHtml(quote: Quote, options?: QuotationRenderOptions) {
  const customerName = quote.lead.companyName || quote.lead.customerName || "Customer";
  const contact = quote.lead.contactPerson || quote.lead.customerName || "—";
  const plantName = quote.plant?.name ?? "SS Metals";
  const plantCode = quote.plant?.code ?? "";
  const quoteDate = formatDate(quote.createdAt);
  const validUntil = formatDateTime(quote.validUntil);
  const leadRef = quote.lead.leadNumber ? escapeHtml(quote.lead.leadNumber) : "—";

  const rows = quote.items
    .map((item, index) => {
      const line = quotationLinePresentation({
        description: item.description,
        grade: item.grade,
        size: item.size,
        product: item.product,
        leadItem: item.leadItem,
      });
      const specHtml = line.spec
        ? `<div class="line-spec">${escapeHtml(line.spec)}</div>`
        : "";
      const deliveryBy =
        item.expectedDeliveryDate ?? item.leadItem?.expectedDeliveryDate ?? null;
      const deliveryLabel = deliveryBy ? formatDate(deliveryBy) : "—";
      return `
    <tr>
      <td class="col-sno">${index + 1}</td>
      <td class="col-desc">
        <div class="line-title">${escapeHtml(line.title)}</div>
        ${specHtml}
      </td>
      <td class="col-grade">${escapeHtml(line.grade)}</td>
      <td class="col-size">${escapeHtml(line.size)}</td>
      <td class="col-delivery">${escapeHtml(deliveryLabel)}</td>
      <td class="col-qty num">${escapeHtml(item.qty.toString())} ${escapeHtml(item.uom)}</td>
      <td class="col-rate num">${item.listRate != null ? formatInr(item.listRate) : "—"}</td>
      <td class="col-rate num">${formatInr(item.rate)}</td>
      <td class="col-amt num">${formatInr(item.amount)}</td>
    </tr>`;
    })
    .join("");

  const tax = quote.taxBreakup as { gstAmount?: string; taxableAmount?: string } | null;
  const gstAmount = tax?.gstAmount ?? "—";

  const termsBlock = [
    quote.paymentTerms ? `<li><strong>Payment:</strong> ${escapeHtml(quote.paymentTerms)}</li>` : "",
    quote.deliveryTerms ? `<li><strong>Delivery:</strong> ${escapeHtml(quote.deliveryTerms)}</li>` : "",
    quote.deliveryTimeDays != null
      ? `<li><strong>Delivery timeline:</strong> ${quote.deliveryTimeDays} days from order confirmation</li>`
      : "",
    quote.includesMtc ? `<li>Material test certificate (MTC) included with dispatch</li>` : "",
    quote.thirdPartyInspection
      ? `<li>Third-party inspection as per agreed scope</li>`
      : "",
  ].filter(Boolean);

  const defaultTerms = `
    <li>Prices are in INR and exclusive of GST unless stated otherwise.</li>
    <li>Quotation validity as mentioned above; rates subject to revision after expiry.</li>
    <li>Dispatch subject to stock availability and confirmed payment terms.</li>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(quote.quotationNumber)} v${quote.version}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 28px 32px 40px;
      font-size: 12px;
      line-height: 1.45;
      background: #fff;
    }
    .doc { max-width: 900px; margin: 0 auto; }
    .brand-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid #1e3a5f;
      margin-bottom: 20px;
    }
    .brand-name { font-size: 22px; font-weight: 700; color: #1e3a5f; margin: 0; letter-spacing: -0.02em; }
    .brand-meta { color: #555; margin: 4px 0 0; font-size: 11px; }
    .doc-title {
      text-align: right;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #1e3a5f;
      margin: 0;
    }
    .doc-sub { text-align: right; font-size: 11px; color: #666; margin-top: 6px; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .box {
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      padding: 12px 14px;
      background: #fafbfc;
    }
    .box h2 {
      margin: 0 0 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #667085;
      font-weight: 700;
    }
    .box p { margin: 2px 0; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .meta-table td { padding: 3px 0; vertical-align: top; }
    .meta-table td:first-child { color: #667085; width: 38%; padding-right: 8px; }
    .lines { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .lines th {
      background: #1e3a5f;
      color: #fff;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 10px 8px;
      border: 1px solid #1e3a5f;
    }
    .lines td {
      border: 1px solid #d0d5dd;
      padding: 8px;
      vertical-align: top;
    }
    .lines tbody tr:nth-child(even) td { background: #f9fafb; }
    .col-sno { width: 32px; text-align: center; }
    .col-desc { min-width: 180px; }
    .col-grade, .col-size { width: 72px; }
    .col-delivery { width: 88px; white-space: nowrap; }
    .col-qty { width: 88px; }
    .col-rate { width: 72px; }
    .col-amt { width: 88px; }
    .line-title { font-weight: 600; color: #111; }
    .line-spec { font-size: 10px; color: #555; margin-top: 3px; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-top: 20px;
    }
    .terms {
      flex: 1;
      border: 1px solid #e4e7ec;
      border-radius: 6px;
      padding: 12px 14px;
      background: #fff;
    }
    .terms h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #344054;
    }
    .terms ul { margin: 0; padding-left: 18px; color: #444; }
    .terms li { margin-bottom: 4px; }
    .totals-wrap { width: 280px; flex-shrink: 0; }
    .totals {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d0d5dd;
      border-radius: 6px;
      overflow: hidden;
    }
    .totals td { padding: 8px 12px; border-bottom: 1px solid #eaecf0; }
    .totals tr:last-child td { border-bottom: none; background: #f2f4f7; }
    .totals .label { color: #475467; }
    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      margin-top: 36px;
      padding-top: 12px;
    }
    .sig-block { flex: 1; text-align: center; }
    .sig-line {
      border-top: 1px solid #98a2b3;
      margin-top: 48px;
      padding-top: 8px;
      font-size: 11px;
      color: #475467;
    }
    .footnote {
      margin-top: 24px;
      font-size: 10px;
      color: #667085;
      text-align: center;
    }
    @media print {
      body { padding: 12px 16px; }
      .box, .terms { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <header class="brand-bar">
      <div>
        <h1 class="brand-name">${escapeHtml(plantName)}</h1>
        ${plantCode ? `<p class="brand-meta">${escapeHtml(plantCode)}</p>` : ""}
      </div>
      <div>
        <p class="doc-title">QUOTATION</p>
        <p class="doc-sub">${escapeHtml(quote.quotationNumber)} · Version ${quote.version}</p>
      </div>
    </header>

    <section class="meta-grid">
      <div class="box">
        <h2>Bill to</h2>
        <p><strong>${escapeHtml(customerName)}</strong></p>
        <p>${escapeHtml(contact)}</p>
        ${quote.lead.phone ? `<p>Phone: ${escapeHtml(quote.lead.phone)}</p>` : ""}
        ${quote.lead.email ? `<p>Email: ${escapeHtml(quote.lead.email)}</p>` : ""}
        ${quote.lead.gstin ? `<p>GSTIN: ${escapeHtml(quote.lead.gstin)}</p>` : ""}
        ${quote.lead.address ? `<p style="margin-top:6px;color:#555;">${escapeHtml(quote.lead.address)}</p>` : ""}
      </div>
      <div class="box">
        <h2>Quotation details</h2>
        <table class="meta-table">
          <tr><td>Quote date</td><td>${quoteDate}</td></tr>
          <tr><td>Valid until</td><td>${validUntil}</td></tr>
          <tr><td>Lead reference</td><td>${leadRef}</td></tr>
          ${quote.createdBy?.name ? `<tr><td>Prepared by</td><td>${escapeHtml(quote.createdBy.name)}</td></tr>` : ""}
        </table>
      </div>
    </section>

    <table class="lines">
      <thead>
        <tr>
          <th class="col-sno">#</th>
          <th class="col-desc">Material / description</th>
          <th class="col-grade">Grade</th>
          <th class="col-size">Size</th>
          <th class="col-delivery">Exp. delivery</th>
          <th class="col-qty">Qty</th>
          <th class="col-rate">Market (₹)</th>
          <th class="col-rate">Offer (₹)</th>
          <th class="col-amt">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer-row">
      <div class="terms">
        <h3>Terms &amp; conditions</h3>
        <ul>
          ${termsBlock.join("")}
          ${defaultTerms}
        </ul>
        ${quote.notes ? `<p style="margin:10px 0 0;"><strong>Notes:</strong> ${escapeHtml(quote.notes)}</p>` : ""}
      </div>
      <div class="totals-wrap">
        <table class="totals">
          <tr><td class="label">Subtotal</td><td class="num">₹ ${formatInr(quote.subtotal)}</td></tr>
          <tr><td class="label">Freight</td><td class="num">₹ ${formatInr(quote.freightAmount)}</td></tr>
          <tr><td class="label">Loading</td><td class="num">₹ ${formatInr(quote.loadingCharges)}</td></tr>
          <tr><td class="label">GST (${escapeHtml(quote.gstPercent.toString())}%)</td><td class="num">₹ ${typeof gstAmount === "string" && gstAmount !== "—" ? formatInr(gstAmount) : escapeHtml(String(gstAmount))}</td></tr>
          <tr><td class="label"><strong>Grand total</strong></td><td class="num"><strong>₹ ${formatInr(quote.total)}</strong></td></tr>
        </table>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">Customer acceptance</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">For ${escapeHtml(plantName)}<br />Authorised signatory</div>
      </div>
    </div>

    ${
      options?.archived && options.sentAt
        ? `<p class="footnote">Sent to customer on ${options.sentAt.toLocaleString("en-IN")}${
            options.sentVia ? ` via ${escapeHtml(options.sentVia.replaceAll("_", " "))}` : ""
          }. This copy is stored on the lead for your records.</p>`
        : `<p class="footnote">This is a computer-generated quotation. Open in your browser and use Print → Save as PDF to share with the customer.</p>`
    }
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
