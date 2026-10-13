"use client";

import { useState } from "react";
import { DeskSidebar } from "@/components/desk-sidebar";
import { DeskTopbar } from "@/components/desk-topbar";
import type { BellNote } from "@/components/notification-bell";

export function DeskShell({
  name,
  plantName,
  shiftLabel,
  unread,
  notes,
  items,
  showShop,
  children,
}: {
  name: string;
  email: string;
  plantName: string;
  shiftLabel: string;
  unread: number;
  notes: BellNote[];
  items: { href: string; label: string; group: string }[];
  showShop: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="flex min-h-screen">
        <DeskSidebar
          items={items}
          plantName={plantName}
          shiftLabel={shiftLabel}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <DeskTopbar
            items={items}
            notes={notes}
            unread={unread}
            name={name}
            showShop={showShop}
            onOpenMenu={() => setMobileOpen(true)}
          />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
