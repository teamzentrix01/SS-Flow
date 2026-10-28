export default function LeadDetailLoading() {
  return (
    <div aria-label="Loading lead details" aria-busy="true" className="mx-auto max-w-[1280px] animate-pulse space-y-[18px] rounded-xl bg-[var(--detail-bg)] p-3 sm:p-5">
      <div className="space-y-2"><div className="h-3 w-32 rounded bg-[var(--detail-border)]" /><div className="h-8 w-64 rounded bg-[var(--detail-border)]" /><div className="h-3 w-72 rounded bg-[var(--detail-border)]" /></div>
      <div className="h-20 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-[18px]">
          <div className="h-36 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
          <div className="h-64 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
        </div>
        <div className="h-64 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
      </div>
      <div className="grid gap-[18px] lg:grid-cols-2">
        <div className="h-48 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
        <div className="h-48 rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
