import Link from "next/link";
import { when } from "@/lib/format";
import { quotationDocumentUrl } from "@/modules/leads/quotations/document-url";
import { quotationStatusLabel } from "@/modules/leads/quotations/status";

export type SentQuotationRow = {
  id: string;
  quotationNumber: string;
  version: number;
  status: string;
  sentAt: Date;
  sentVia: string | null;
  total: { toString(): string };
};

export function LeadSentQuotationDownloads({ quotations }: { quotations: SentQuotationRow[] }) {
  if (!quotations.length) return null;

  const latest = quotations[0];

  return (
    <section className="rounded-xl border border-info/30 bg-info/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Sent quotation</h2>
          <p className="mt-0.5 text-xs text-muted">
            Download what was shared with the customer. Older sends without a saved snapshot still use
            pricing stored on this quotation record.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex h-10 items-center rounded-lg bg-info px-4 text-sm font-semibold text-white hover:opacity-90"
            href={quotationDocumentUrl(latest.id, true)}
            download
          >
            Download latest
          </a>
          <a
            className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted/40"
            href={quotationDocumentUrl(latest.id, false)}
            target="_blank"
            rel="noreferrer"
          >
            View / print
          </a>
        </div>
      </div>

      {quotations.length > 1 ? (
        <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {quotations.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {row.quotationNumber} v{row.version} · {quotationStatusLabel(row.status)}
                </p>
                <p className="text-xs text-muted">
                  Sent {when(row.sentAt)} · Total ₹{row.total.toString()}
                  {row.sentVia ? ` · ${row.sentVia.replaceAll("_", " ")}` : ""}
                  {" · From quotation record"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="text-sm font-medium text-info hover:underline"
                  href={quotationDocumentUrl(row.id, true)}
                  download
                >
                  Download
                </a>
                <Link
                  className="text-sm font-medium text-muted hover:text-foreground"
                  href={quotationDocumentUrl(row.id, false)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {latest.quotationNumber} v{latest.version} · Sent {when(latest.sentAt)} · ₹
          {latest.total.toString()}
          {" · Built from saved quotation lines"}
        </p>
      )}
    </section>
  );
}
