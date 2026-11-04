export function quotationDocumentUrl(quotationId: string, download = false) {
  const base = `/api/v1/quotations/${quotationId}/pdf`;
  return download ? `${base}?download=1` : base;
}

export function quotationWasSentToCustomer(status: string) {
  return ["SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"].includes(status.toUpperCase());
}
