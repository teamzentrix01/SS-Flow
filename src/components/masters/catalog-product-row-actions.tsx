"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function CatalogProductRowActions({ id }: { id: string }) {
  const { post, pending } = usePost();
  return (
    <TableRowActions
      actions={[
        { label: "View product", href: `/products/catalog/${id}`, icon: Eye },
        { label: "Edit product", href: `/products/catalog/${id}/edit`, icon: Pencil },
        {
          label: "Soft delete product",
          icon: Trash2,
          tone: "danger",
          disabled: pending,
          confirm: {
            title: "Delete product?",
            message:
              "You're about to soft delete this product. You can review it later, but it won't appear in your active catalog.",
            consequence: (
              <>
                <b className="font-semibold text-[#16181D]">
                  Hidden from active products and stock.
                </b>{" "}
                SKU data, history and transactions are preserved.
              </>
            ),
            confirmText: "Delete product",
            cancelText: "Cancel",
            tone: "danger",
          },
          onClick: () =>
            post(`/api/v1/masters/catalog-products/${id}/delete`, {}, "/products?tab=products"),
        },
      ]}
    />
  );
}
