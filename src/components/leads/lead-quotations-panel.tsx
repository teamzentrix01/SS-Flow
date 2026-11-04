"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, controlClass } from "@/components/ui";
import { FormFeedback } from "@/components/form-feedback";
import { usePost } from "@/components/use-post";
import { QuotationDraftEditor } from "@/components/leads/quotation-draft-editor";
import { QuotationSentRecord } from "@/components/leads/quotation-sent-record";
import {
  quotationDocumentUrl,
  quotationWasSentToCustomer,
} from "@/modules/leads/quotations/document-url";
import { quotationStatusLabel } from "@/modules/leads/quotations/status";

type QuotationSummary = {
  id: string;
  quotationNumber: string;
  version: number;
  groupId: string;
  status: string;
  validUntil: string;
  total: string;
  approvalRequired: boolean;
  approvedAt: string | null;
  sentAt: string | null;
  sentVia: string | null;
  hasSentCopy: boolean;
  createdAt: string;
  itemCount: number;
};

const actionLinkClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent-soft hover:border-accent/30";

const actionPrimaryLinkClass =
  "btn-primary inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-white hover:opacity-90";

function validityLabel(validUntil: string, status: string) {
  if (status === "EXPIRED") return { text: "Expired", tone: "text-danger" as const };
  const ms = new Date(validUntil).getTime() - Date.now();
  if (ms <= 0) return { text: "Past validity", tone: "text-amber-700 dark:text-amber-300" as const };
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return { text: `${hours}h left`, tone: "text-amber-700 dark:text-amber-300" as const };
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return { text: `${days} day(s) left`, tone: "text-muted" as const };
}

export function LeadQuotationsPanel({
  leadId,
  canManage,
  canApprove,
}: {
  leadId: string;
  canManage: boolean;
  canApprove: boolean;
}) {
  const [rows, setRows] = useState<QuotationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sentVia, setSentVia] = useState<"EMAIL" | "WHATSAPP" | "MANUAL">("MANUAL");
  const router = useRouter();
  const createPost = usePost();
  const actionPost = usePost();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/quotations`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not load quotations.");
        return;
      }
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => {
    const byGroup = new Map<string, QuotationSummary[]>();
    for (const row of rows) {
      const list = byGroup.get(row.groupId) ?? [];
      list.push(row);
      byGroup.set(row.groupId, list);
    }
    return [...byGroup.values()].map((versions) =>
      [...versions].sort((a, b) => a.version - b.version),
    );
  }, [rows]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function createDraft() {
    const data = await createPost.post<{ id?: string }>(
      `/api/v1/leads/${leadId}/quotations`,
      {},
      { successMessage: "Draft quotation created." },
    );
    if (data?.id) setSelectedId(data.id);
    if (data) void load();
  }

  async function runAction(action: "send" | "revise" | "approve", id: string) {
    const body = action === "send" ? { sentVia } : undefined;
    const data = await actionPost.post<{ id?: string }>(`/api/v1/quotations/${id}/${action}`, body, {
      successMessage:
        action === "send"
          ? "Quotation sent."
          : action === "revise"
            ? "Revision draft created."
            : "Quotation approved.",
    });
    if (action === "revise" && data?.id) setSelectedId(data.id);
    if (data) void load();
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)] shadow-sm">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--detail-border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[12px] font-bold text-[var(--detail-text)]">Quotations</h2>
          <p className="mt-0.5 text-[11px] text-[var(--detail-muted)]">
            Set market &amp; offer price per lead item, save on the lead, then send PDF to the customer.
          </p>
        </div>
        {canManage ? (
          <Button type="button" pending={createPost.pending} onClick={() => void createDraft()}>
            New draft from lead items
          </Button>
        ) : null}
      </div>

      <div className="p-4">
        {loading ? <p className="text-sm text-muted">Loading quotations…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {!loading && !rows.length ? (
          <p className="text-sm text-muted">No quotations yet. Create a draft to prepare a quote.</p>
        ) : null}

        {rows.length ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            <div className="space-y-3">
              {timeline.map((chain) => (
                <div key={chain[0]?.groupId} className="rounded-lg border border-border/70 bg-muted/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {chain[0]?.quotationNumber}
                  </p>
                  <ol className="mt-2 space-y-2">
                    {chain.map((row) => {
                      const validity = validityLabel(row.validUntil, row.status);
                      const active = selectedId === row.id;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                              active ? "border-info bg-info/5" : "border-border bg-card hover:bg-muted/30"
                            }`}
                            onClick={() => setSelectedId(row.id)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                v{row.version} · {quotationStatusLabel(row.status)}
                              </span>
                              <span className={`text-xs ${validity.tone}`}>{validity.text}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              Total ₹{row.total} · {row.itemCount} line(s)
                              {row.sentAt ? ` · Sent ${new Date(row.sentAt).toLocaleDateString("en-IN")}` : ""}
                              {row.hasSentCopy ? " · Copy saved" : ""}
                            </p>
                            {row.approvalRequired && !row.approvedAt && row.status === "DRAFT" ? (
                              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                Manager approval required before send
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-muted/5 p-4">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--detail-text)]">
                      {selected.quotationNumber} · Version {selected.version}
                    </p>
                    <p className="text-xs text-muted">{quotationStatusLabel(selected.status)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 border-b border-border/70 pb-4">
                    {quotationWasSentToCustomer(selected.status) ? (
                      <>
                        <a
                          className={actionPrimaryLinkClass}
                          href={quotationDocumentUrl(selected.id, true)}
                          download
                        >
                          Download quotation
                        </a>
                        <a
                          className={actionLinkClass}
                          href={quotationDocumentUrl(selected.id, false)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View / print
                        </a>
                      </>
                    ) : (
                      <a
                        className={actionLinkClass}
                        href={quotationDocumentUrl(selected.id, false)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview quotation
                      </a>
                    )}
                    {canManage && selected.status === "DRAFT" && selected.approvalRequired && !selected.approvedAt && canApprove ? (
                      <Button type="button" tone="ghost" pending={actionPost.pending} onClick={() => void runAction("approve", selected.id)}>
                        Approve discount
                      </Button>
                    ) : null}
                    {canManage && (selected.status === "SENT" || selected.status === "EXPIRED") ? (
                      <Button type="button" tone="ghost" pending={actionPost.pending} onClick={() => void runAction("revise", selected.id)}>
                        Revise (new version)
                      </Button>
                    ) : null}
                  </div>

                  {canManage && selected.status === "DRAFT" ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[160px] flex-1 sm:max-w-[200px]">
                        <Field label="Send via">
                          <select
                            className={controlClass}
                            value={sentVia}
                            onChange={(e) => setSentVia(e.target.value as typeof sentVia)}
                          >
                            <option value="EMAIL">Email</option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="MANUAL">Manual</option>
                          </select>
                        </Field>
                      </div>
                      <Button
                        type="button"
                        pending={actionPost.pending}
                        disabled={selected.approvalRequired && !selected.approvedAt}
                        onClick={() => void runAction("send", selected.id)}
                      >
                        Mark sent
                      </Button>
                    </div>
                  ) : null}

                  <FormFeedback error={actionPost.error || createPost.error} success={actionPost.success || createPost.success} />

                  {selected.status === "DRAFT" ? (
                    <QuotationDraftEditor
                      quotationId={selected.id}
                      canEdit={canManage}
                      onSaved={() => {
                        void load();
                        router.refresh();
                      }}
                    />
                  ) : quotationWasSentToCustomer(selected.status) ? (
                    <QuotationSentRecord quotationId={selected.id} />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted">Select a version on the left to preview, price, or send.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
