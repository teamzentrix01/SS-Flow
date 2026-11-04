export function defaultRepeatOrderFollowUpDays() {
  const raw = Number(process.env.REPEAT_ORDER_FOLLOW_UP_DAYS ?? "30");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

export function resolveRepeatOrderFollowUpDays(input: {
  leadDays?: number | null;
  customerDays?: number | null;
}) {
  if (input.leadDays != null && input.leadDays > 0) return input.leadDays;
  if (input.customerDays != null && input.customerDays > 0) return input.customerDays;
  return defaultRepeatOrderFollowUpDays();
}

export function addCalendarDays(from: Date, days: number) {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}
