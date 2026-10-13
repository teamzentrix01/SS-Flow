"use client";

import { useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { getCoreRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type Row = {
  batchId: string;
  batchNo: string;
  material: string;
  grade: string;
  thickness: string;
  location: string;
  available: string;
  reserved: string;
  hold: string;
  finished: string;
};

const columns: LegacyColumnDef<Row>[] = [
  {
    accessorKey: "batchNo",
    header: "Batch",
    cell: ({ row }) => <Link className="font-medium text-accent hover:text-accent-hover hover:underline" href={`/inventory/batches/${row.original.batchId}`}>{row.original.batchNo}</Link>,
  },
  { accessorKey: "material", header: "Material" },
  { accessorKey: "grade", header: "Grade" },
  { accessorKey: "thickness", header: "Thk" },
  { accessorKey: "location", header: "Location" },
  { accessorKey: "available", header: "Available" },
  { accessorKey: "reserved", header: "Reserved" },
  { accessorKey: "hold", header: "QC hold" },
  { accessorKey: "finished", header: "Finished" },
];

export function BalanceTable({ initial, canPurchase }: { initial: Row[]; canPurchase: boolean }) {
  const [queryText, setQueryText] = useState("");
  const query = useQuery({
    queryKey: ["balances"],
    queryFn: async () => {
      const response = await fetch("/api/v1/inventory/balances");
      const json = await response.json();
      return json.data as Row[];
    },
    initialData: initial,
  });
  const needle = queryText.trim().toLowerCase();
  const rows = needle
    ? query.data.filter((row) => `${row.batchNo} ${row.material} ${row.grade} ${row.location}`.toLowerCase().includes(needle))
    : query.data;
  const table = useLegacyTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">{query.data.length} batch{query.data.length === 1 ? "" : "es"}</p>
        <input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder="Search batch, material, location"
          aria-label="Search stock"
          className="h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-muted">{query.data.length === 0 ? "No batches in stock." : "No batches match that search."}</p>
            {query.data.length === 0 && canPurchase ? <Link href="/purchasing/orders" className="btn-primary mt-4">Open purchase orders</Link> : null}
          </div>
        ) : rows.map((row) => (
          <article key={row.batchId} className="rounded-xl border border-border p-4">
            <Link className="font-semibold text-steel" href={`/inventory/batches/${row.batchId}`}>{row.batchNo}</Link>
            <p className="mt-1 text-sm text-muted">{row.material} · {row.location}</p>
            <p className="mt-2 text-sm">Available {row.available}</p>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-medium text-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="px-4 py-3 font-medium">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <p className="font-semibold">{query.data.length === 0 ? "No batches in stock" : "No batches match that search"}</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                    {query.data.length === 0
                      ? "Receive a purchase order, then pass incoming QC. Available kilograms show up in this table."
                      : "Try another batch number, material, or location."}
                  </p>
                  {query.data.length === 0 && canPurchase ? <Link href="/purchasing/orders" className="btn-primary mt-4">Open purchase orders</Link> : null}
                </td>
              </tr>
            ) : table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition hover:bg-accent-soft">
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
