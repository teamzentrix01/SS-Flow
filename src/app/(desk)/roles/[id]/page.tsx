import Link from "next/link";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getRoleDetail } from "@/modules/rbac/roles";
import { notFound } from "next/navigation";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("role.manage");
  const { id } = await params;
  const role = await getRoleDetail(id);
  if (!role) notFound();
  const byModule = new Map<string, typeof role.permissions>();
  for (const link of role.permissions) {
    const mod = link.permission.module ?? "General";
    const list = byModule.get(mod) ?? [];
    list.push(link);
    byModule.set(mod, list);
  }
  return (
    <DeskFormPage title={role.name} backHref="/roles" backLabel="Back to roles">
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-muted/30 px-3 py-1">Code: {role.code}</span>
        <span className="rounded-full bg-muted/30 px-3 py-1">{role.isSystem ? "System role" : "Custom role"}</span>
        <span className="rounded-full bg-muted/30 px-3 py-1">{role.isActive ? "Active" : "Inactive"}</span>
        <span className="rounded-full bg-muted/30 px-3 py-1">{role._count.users} users</span>
        <Link href={`/roles/${role.id}/edit`} className="font-semibold text-accent">
          Edit role
        </Link>
      </div>
      {role.description ? <p className="mb-4 text-sm text-muted">{role.description}</p> : null}
      <div className="space-y-4">
        {[...byModule.entries()].map(([module, links]) => (
          <section key={module} className="rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold">{module}</h2>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {links.map((link) => (
                <li key={link.permissionId} className="text-sm">
                  {link.permission.name}{" "}
                  <span className="text-xs text-muted">({link.permission.code})</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DeskFormPage>
  );
}
