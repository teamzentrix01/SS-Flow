"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, controlClass } from "@/components/ui";
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

const outlineBtn =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted/40";

const accentOutlineBtn =
  "inline-flex h-10 items-center justify-center rounded-lg border border-info/40 bg-card px-4 text-sm font-semibold text-info transition hover:border-info hover:bg-info/5";

function validityLabel(validUntil: string, status: string) {
  if (status === "EXPIRED") return { text: "Expired", tone: "text-danger" as const };
  const ms = new Date(validUntil).getTime() - Date.now();
  if (ms <= 0) return { text: "Past validity", tone: "text-amber-700 dark:text-amber-300" as const };
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return { text: `${hours}h left`, tone: "text-amber-700 dark:text-amber-300" as const };
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return { text: `${days} day(s) left`, tone: "text-muted" as const };
}

function QuotationStatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {quotationStatusLabel(status)}
    </span>
  );
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

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.version - a.version,
      ),
    [rows],
  );

  useEffect(() => {
    if (!sortedRows.length) return;
    if (!selectedId || !sortedRows.some((row) => row.id === selectedId)) {
      setSelectedId(sortedRows[0].id);
    }
  }, [sortedRows, selectedId]);

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
    <section className="overflow-hidden rounded-2xl border border-[var(--detail-border)] bg-[var(--surface)] shadow-sm">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--detail-border)] px-5 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--detail-muted)]">
          Quotations
        </p>
        {canManage ? (
          <Button type="button" pending={createPost.pending} onClick={() => void createDraft()}>
            New draft from lead items
          </Button>
        ) : null}
      </div>

      <div className="p-5">
        {loading ? <p className="text-sm text-muted">Loading quotations…</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {!loading && !rows.length ? (
          <p className="text-sm text-muted">No quotations yet. Create a draft to prepare a quote.</p>
        ) : null}

        {rows.length ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Quotations</p>
              <ul className="space-y-2">
                {sortedRows.map((row) => {
                  const validity = validityLabel(row.validUntil, row.status);
                  const active = selectedId === row.id;
                  const pendingApproval = !row.approvedAt && row.status === "DRAFT";
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl border px-4 py-3 text-left transition shadow-sm ${
                          active
                            ? "border-info bg-card ring-2 ring-info/20"
                            : "border-border/80 bg-card hover:border-info/30 hover:bg-muted/20"
                        }`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{row.quotationNumber}</span>
                          <span className={`shrink-0 text-xs font-medium ${validity.tone}`}>{validity.text}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted">v{row.version}</span>
                          <span className="text-muted">·</span>
                          <QuotationStatusPill status={row.status} />
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          ₹{row.total} · {row.itemCount} line{row.itemCount === 1 ? "" : "s"}
                        </p>
                        {pendingApproval ? (
                          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
                            Admin approval needed before send
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl border border-border/70 bg-muted/15 p-4 sm:p-5">
              {selected ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {selected.quotationNumber}
                      </h3>
                      <span className="text-sm text-muted">· Version {selected.version}</span>
                      <QuotationStatusPill status={selected.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && selected.status === "DRAFT" ? (
                        <>
                          <label className="flex items-center gap-2 text-sm text-muted">
                            <span className="whitespace-nowrap">Send via</span>
                            <select
                              className={`${controlClass} h-10 min-w-[120px] py-0`}
                              value={sentVia}
                              onChange={(e) => setSentVia(e.target.value as typeof sentVia)}
                            >
                              <option value="EMAIL">Email</option>
                              <option value="WHATSAPP">WhatsApp</option>
                              <option value="MANUAL">Manual</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            pending={actionPost.pending}
                            disabled={!selected.approvedAt}
                            onClick={() => void runAction("send", selected.id)}
                          >
                            Mark sent
                          </Button>
                        </>
                      ) : null}

                      {quotationWasSentToCustomer(selected.status) ? (
                        <>
                          <a className="btn-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold" href={quotationDocumentUrl(selected.id, true)} download>
                            Download
                          </a>
                          <a className={outlineBtn} href={quotationDocumentUrl(selected.id, false)} target="_blank" rel="noreferrer">
                            View / print
                          </a>
                        </>
                      ) : (
                        <a
                          className={outlineBtn}
                          href={quotationDocumentUrl(selected.id, false)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preview
                        </a>
                      )}

                      {canManage && selected.status === "DRAFT" && !selected.approvedAt && canApprove ? (
                        <button
                          type="button"
                          className={accentOutlineBtn}
                          disabled={actionPost.pending}
                          onClick={() => void runAction("approve", selected.id)}
                        >
                          Approve pricing
                        </button>
                      ) : null}

                      {canManage && (selected.status === "SENT" || selected.status === "EXPIRED") ? (
                        <Button type="button" tone="ghost" pending={actionPost.pending} onClick={() => void runAction("revise", selected.id)}>
                          Revise
                        </Button>
                      ) : null}
                    </div>
                  </div>

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
                <p className="text-sm text-muted">Select a quotation on the left to price or send.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}