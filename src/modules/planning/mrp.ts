import { fromMilli, toMilli } from "@/lib/domain/qty";

export type BomLineInput = {
  materialId: string;
  qtyPer: string;
  lossPct: string;
  uom: string;
};

export type MrpLineResult = {
  materialId: string;
  grossQty: string;
  scrapQty: string;
  netQty: string;
  uom: string;
};

export type StockPool = {
  materialId: string;
  availableQty: bigint;
  reservedOtherQty: bigint;
  incomingQty: bigint;
};

export type NetRequirement = MrpLineResult & {
  usableAvailable: string;
  reservedOther: string;
  incomingEligible: string;
  netProcurement: string;
};

export function explodeBomForLine(orderQty: string, scrapRate: string, lines: BomLineInput[]): MrpLineResult[] {
  const qty = toMilli(orderQty);
  const headerScrap = toMilli(scrapRate);
  const byMaterial = new Map<string, { gross: bigint; scrap: bigint; uom: string }>();

  for (const line of lines) {
    const per = toMilli(line.qtyPer);
    const lineLoss = toMilli(line.lossPct);
    const gross = (qty * per) / 1000n;
    const lineScrap = (gross * lineLoss) / 10000n;
    const headerExtra = (gross * headerScrap) / 10000n;
    const scrap = lineScrap + headerExtra;
    const existing = byMaterial.get(line.materialId) ?? { gross: 0n, scrap: 0n, uom: line.uom };
    existing.gross += gross;
    existing.scrap += scrap;
    byMaterial.set(line.materialId, existing);
  }

  return [...byMaterial.entries()].map(([materialId, row]) => {
    const net = row.gross + row.scrap;
    return {
      materialId,
      grossQty: fromMilli(row.gross),
      scrapQty: fromMilli(row.scrap),
      netQty: fromMilli(net),
      uom: row.uom,
    };
  });
}

export function netProcurementForMaterial(
  need: MrpLineResult,
  pool: StockPool | undefined,
  allocatedToThisOrder: bigint,
): NetRequirement {
  const needNet = toMilli(need.netQty);
  const available = pool?.availableQty ?? 0n;
  const reservedOther = pool?.reservedOtherQty ?? 0n;
  const incoming = pool?.incomingQty ?? 0n;
  const covered = available + allocatedToThisOrder;
  let remaining = needNet > covered ? needNet - covered : 0n;
  if (remaining > reservedOther) remaining -= reservedOther;
  else remaining = 0n;
  if (remaining > incoming) remaining -= incoming;
  else remaining = 0n;

  return {
    ...need,
    usableAvailable: fromMilli(available),
    reservedOther: fromMilli(reservedOther),
    incomingEligible: fromMilli(incoming),
    netProcurement: fromMilli(remaining > 0n ? remaining : 0n),
  };
}

export function maxProducibleUnits(orderQty: string, limitingQtyPer: string, availableForLine: bigint): number {
  const order = toMilli(orderQty);
  const per = toMilli(limitingQtyPer);
  if (per <= 0n) return Number(order) / 1000;
  const max = (availableForLine * 1000n) / per;
  const maxNum = Number(max / 1000n);
  const orderNum = Number(order / 1000n);
  return Math.min(maxNum, orderNum);
}
