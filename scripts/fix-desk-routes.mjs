import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..", "src");
const reps = [
  ["/settings/users", "/users"],
  ["/people/employees", "/employees"],
  ["/masters/categories", "/categories"],
  ["/masters/products", "/products"],
  ["/purchasing/suppliers", "/suppliers"],
  ["/purchasing/orders", "/purchase-orders"],
  ["/purchasing/requisitions", "/requisitions"],
  ["/purchasing/receipts", "/receipts"],
];

function walk(dir) {
  let changed = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) changed += walk(p);
    else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      let s = fs.readFileSync(p, "utf8");
      const o = s;
      for (const [a, b] of reps) {
        if (a.startsWith("/masters/") && s.includes("@/modules/masters/")) {
          s = s.replace(new RegExp(`(?<!@/modules)${a.replace(/\//g, "\\/")}`, "g"), b);
        } else {
          s = s.split(a).join(b);
        }
      }
      if (s !== o) {
        fs.writeFileSync(p, s);
        changed++;
      }
    }
  }
  return changed;
}

console.log("files updated:", walk(root));
