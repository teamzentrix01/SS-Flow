"use client";

import { useCallback, useEffect, useState } from "react";

type QuotationRecord = {
  quotationNumber: string;
  version: number;
  status: string;
  sentAt: string | null;
  sentVia: string | null;
  hasSentCopy: boolean;
  total: string;
  items: {
    description: string | null;
    grade: string | null;
    size: string | null;
    qty: string;
    uom: string;
    listRate: string | null;
    rate: string;
    amount: string;
    expectedDeliveryDate: string | null;
  }[];
};

export function QuotationSentRecord({ quotationId }: { quotationId: string }) {
  const [record, setRecord] = useState<QuotationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/quotations/${quotationId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        setRecord(null);
        return;
      }
      const data = json.data as QuotationRecord;
      setRecord(data);
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted">Loading sent copy…</p>;
  if (!record) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">Your copy (what was sent)</p>
        <p className="text-xs text-muted">
          {record.hasSentCopy
            ? "Frozen snapshot saved when this version was marked sent."
            : "Pricing from this version (sent before snapshot feature)."}
          {record.sentAt
            ? ` · ${new Date(record.sentAt).toLocaleString("en-IN")}${
                record.sentVia ? ` · ${record.sentVia.replaceAll("_", " ")}` : ""
              }`
            : null}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-2">Product</th>
              <th className="pb-2 pr-2 text-right">Market</th>
              <th className="pb-2 pr-2 text-right">Offered</th>
              <th className="pb-2 pr-2">Exp. delivery</th>
              <th className="pb-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((line, index) => (
              <tr key={index} className="border-t border-border/70">
                <td className="py-2 pr-2">
                  <p className="font-medium">{line.description ?? "—"}</p>
                  <p className="text-xs text-muted">
                    {[line.grade, line.size].filter(Boolean).join(" · ") || null}
                    {line.qty ? ` · ${line.qty} ${line.uom}` : null}
                  </p>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {line.listRate ? `₹${line.listRate}` : "—"}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">₹{line.rate}</td>
                <td className="py-2 pr-2 text-sm">
                  {line.expectedDeliveryDate
                    ? new Date(line.expectedDeliveryDate).toLocaleDateString("en-IN")
                    : "—"}
                </td>
                <td className="py-2 text-right tabular-nums">₹{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        Quotation total: <span className="font-semibold text-foreground">₹{record.total}</span>
      </p>
    </div>
  );
}
