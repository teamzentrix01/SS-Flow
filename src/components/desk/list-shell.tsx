import { PageHeader } from "@/components/ui";

export function DeskListShell({
  title,
  detail,
  action,
  children,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader title={title} detail={detail} action={action} />
      {children}
    </div>
  );
}
