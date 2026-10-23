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
          onClick: () => {
            if (pending || !window.confirm("Soft delete this product? It will be hidden from product and stock SKU lists.")) return;
            void post(`/api/v1/masters/catalog-products/${id}/delete`, {}, "/products?tab=products");
          },
        },
      ]}
    />
  );
}
