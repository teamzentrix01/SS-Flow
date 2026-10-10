const SCALE = 1000n;

export function toMilli(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error("QTY_INVALID");
  }
  const negative = raw.startsWith("-");
  const [wholePart, fracPart = ""] = raw.replace("-", "").split(".");
  const frac = `${fracPart}000`.slice(0, 3);
  const milli = BigInt(wholePart || "0") * SCALE + BigInt(frac);
  return negative ? -milli : milli;
}

export function fromMilli(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function addMilli(left: bigint, right: bigint) {
  return left + right;
}

export function qtyText(value: { toString(): string } | string | number | null | undefined) {
  if (value === null || value === undefined) return "0.000";
  return fromMilli(toMilli(value.toString()));
}
