# Business categories — Trading and Manufactured

SS-Metals now has exactly two top-level **business** categories. Inventory types (raw material, WIP, finished goods, consumable, scrap) remain subcategories under them. No parallel category table was added; the existing `product_categories.parent_id` tree is used.

| Code | Name | Meaning |
| --- | --- | --- |
| `TRADING` | Trading Products | Purchased from suppliers, received into inventory, supplied to customers |
| `MFG` | Manufactured Products | Made or processed in the factory (job cards / BOM), then finished-goods inventory and customer supply |

Admins cannot create a third top-level business line. New categories must pick Trading or Manufactured (or a subcategory under them) as parent. The two roots cannot be deleted or reparented.

## Mapping of existing records

No product families were duplicated. Existing SKUs were reparented in place.

### Trading Products

| Record | Evidence |
| --- | --- |
| Coil (`COIL`, `RM-COIL`, Stainless Steel Coil) | Purchased raw, `supplyMode = purchased` |
| Sheet (`SHEET`, `RM-SHEET`, Aluminium Sheet, stell sheet) | Purchased sheet stock |
| Rod, Wire, Pipe | Seeded steel stock, purchased |
| Consumables / Welding Rods | Purchased factory supplies |
| `HELLO09` / hello | User sheet category, treated as trading |
| `TEST-CATEGORY` / Riyaz product | Purchased consumable with an existing PO |

Mirror, Matt & PVD Sheets: **no separate product families exist** in current data. They should be created later as Sheet sub-types under Trading, not as new top-level categories.

### Manufactured Products

| Record | Evidence |
| --- | --- |
| Laser Cut / Farma (`FARMA`) | Semi-finished factory processing; supply mode aligned to `manufactured` |
| Blank / Cut Blanks / Slit Strips / Slit coil | In-house processing (`SEMI-FG` / `SFG`) |
| Utensils, Stainless spoon | Finished goods with BOM and production orders |
| Scrap & Waste | Production by-product |

### Flagged for confirmation

1. **Circle** — SKU `CIRCLE`, `productType = semi_finished`, `supplyMode = both`. Nested under Manufactured via Semi-Finished so the catalog is complete, but **not locked** to manufactured-only. Confirm whether Circle is bought in, laser-cut in-house, or both.
2. **PCS** — Not a product family. It is a unit of measure (utensils such as FG-SPOON). No PCS product type was created.
3. **Pipe** — Present as purchased steel stock; kept under Trading even though the original brief did not list Pipe.
4. **Blank / FG-SLIT** — Has both purchase orders and production orders. Flags were left as dual-flow (`purchaseAllowed` and `manufacturingAllowed`).
5. **HR coil (`RM-COIL`)** — Trading item that also has a production order; `manufacturingAllowed` was left on so existing jobs are not blocked.
6. User test rows (`hammer`, `devansh`, `Riyaz product`) were reparented by their current category, not renamed.

## Workflows

- **Trading:** purchase allowed → goods receipt → inventory → sales/dispatch. BOM is not required on sales approve (`salesLineRequiresBom` still skips raw/consumable and `manufacturingAllowed = false`).
- **Manufactured:** manufacturing allowed → job card / routing / BOM → finished inventory → customer supply. Purchase is blocked when the SKU has no purchase history.

## How to apply on a database

```bash
npx tsx scripts/ensure-business-categories.ts
```

`prisma/seed.ts` also calls this after catalog seed. The command is idempotent: it upserts the two roots per plant and only reparents categories that currently have `parent_id = null`.

## Unresolved business decisions

- Confirm Circle as trading, manufactured, or both.
- Whether Mirror / Matt / PVD should be distinct Sheet subcategories.
- Whether Pipe should remain a trading family.
- Whether dual-flow Blank/slit coil should stay `both`.
