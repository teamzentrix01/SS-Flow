# Steel Material aur Inventory Audit (Hinglish)

## Is audit ka nateeja

Purchase Order banana, approve karna, ya supplier ko bhejna stock ko increase nahi karta. PO sirf kharid ka commitment aur expected quantity rakhta hai. Physical stock goods receipt post hone par ledger mein aata hai. Pehle accepted receipt quantity QC hold mein jaati thi; QC pass hone par available stock banti thi. Is audit mein reject quantity, supplier trace aur production consumption recording ke gaps bhi mile aur unke liye code/schema changes add kiye gaye.

## Current process aur modules ka connection

1. **Material master / category** — Category ab apne required steel attributes configure kar sakti hai: grade, thickness, width, length, diameter aur weight per piece. Product create/edit form in attributes ko capture karta hai; server bhi required values validate karta hai.
2. **Purchase order** — PO lines material, ordered quantity, UOM, rate aur ordered specs rakhti hain. PO ki create/approve/send commands stock balance ya stock ledger mein movement nahi likhti.
3. **Goods receipt (GRN)** — Draft receipt delivered quantity ko accepted aur rejected quantity mein split karti hai; unka total delivered ke barabar hona chahiye. Accepted quantity outstanding PO quantity se zyada nahi ho sakti. Receipt unit PO line se match aur material ke stock UOM mein convertible honi chahiye.
4. **Posting aur stock ledger** — Posted GRN ek internal batch ID banata hai; supplier batch number aur heat number uske saath trace hote hain. Accepted quantity QC-hold bucket mein post hoti hai. Rejected quantity rejected bucket mein jaati hai aur available/QC-hold stock nahi banti. Stock UOM material ke base UOM mein record hota hai; KG/tonne conversion supported hai. Count aur weight units ke beech conversion tab tak nahi hota jab tak actual count-to-weight measurement system na ho.
5. **Incoming QC** — QC decision batch ke assumed `weight` ke bajay us location ke actual QC-hold balance ko pass/reject karta hai. Pass par hold quantity available hoti hai; fail par rejected bucket mein move hoti hai.
6. **Batch detail** — Internal aur supplier batch IDs, GRN/PO/supplier, received specs, PO rate, har location ka UOM-wise balance, ledger aur production issue records dikhte hain.
7. **Production** — Job start par ledger issue ke saath `ProductionMaterialIssue` mein job, source batch aur issued quantity link hoti hai. Job approval par actual consumed aur returned quantity us record par save hoti hai. Output batch ka source batch se `BatchLink` genealogy link bana rehta hai.

## Requirements ka status

| Requirement | Status | Evidence / limitation |
| --- | --- | --- |
| PO create/approve/send se stock increase na ho | **Sahi tha; confirm hua** | `purchase-orders.ts` PO rows aur audit likhta hai; stock movements nahi. |
| Actual receipt posting se hi stock aaye | **Sahi tha; improve hua** | GRN draft stock nahi badalta; post action ledger movement banata hai. |
| QC pass se pehle accepted stock available na ho | **Sahi tha; confirm hua** | Accepted GRN stock `qcHold` mein post hota hai; pass par hi release hota hai. |
| Supplier se aayi rejected qty stock mein alag dikhe | **Gap fix kiya** | Ab receipt rejection `receipt_reject` ledger movement aur rejected balance hai; available stock nahi. |
| Supplier batch aur internal batch alag hon | **Gap fix kiya** | Internal `BATCH-...` ID, supplier batch number aur heat number separate persist hote hain. |
| GRN par aaye actual material specs save hon | **Gap fix kiya** | Grade, thickness, width, length, diameter aur finish receipt item/batch par snapshot hote hain; PO values fallback hain. |
| Category anusar steel specs mandatory hon | **Add kiya** | Category required-spec list ke hisaab se product save par server validation bhi chalti hai. Purani categories ki empty list backward-compatible hai. |
| UOM stock ko galat tarah mix na kare | **Safety checks add kiye** | Receipt quantity material UOM mein convert hoti hai. Mass conversion aur same-unit conversion supported hai; incompatible units reject hote hain. |
| Job par kis batch se kitna consume hua trace ho | **Partial support add kiya** | Existing job flow ek source batch issue karta hai; issue, consumed aur returned qty persist hoti hai. Ek job mein multiple source batches abhi supported nahi. |
| Output se source batch tak genealogy ho | **Partial** | Existing `BatchLink` output ko source batch se jodta hai. Multi-source consumption ke liye relation ko expand karna hoga. |
| Multiple warehouses/location aur stock bucket trace | **Existing ledger/balance system** | Balance per batch-location hai aur transfer ledger movements likhta hai. Batch ka legacy `locationId` multi-location stock ka authoritative summary nahi; balances authoritative hain. |
| Stock valuation / landed cost | **Abhi nahi** | PO rate available hai, par inventory valuation (FIFO/weighted average/landed cost) ka end-to-end policy implemented nahi hai. |
| Material substitution / interchangeability | **Abhi nahi** | Reservation aur BOM identity material/SKU par based hai; grade/dimension ke equivalent substitutes ke liye rule-based eligibility nahi. |
| Plant / warehouse location trace | **Partial** | Stock balance batch-location par maintained hai; transferred batch ke legacy single `locationId` par bharosa nahi karna chahiye. Balance rows aur ledger per-location source hain. |
| Multiple source batches per production job | **Abhi nahi** | JobCard mein ek `batchId` hai. `ProductionMaterialIssue` ab batch-level record karta hai, lekin ek job ke liye multi-batch issue UI/command abhi design nahi hua. |

## Code aur migration

Schema change ke liye `20261021120000_material_specs_batch_genealogy` migration add hui hai. Ismein category rules, receipt spec snapshots, batch supplier/weight fields, production issue genealogy fields aur GRN ledger line references ko non-unique karne ka change hai. Existing data ko delete/rewrite nahi kiya gaya.

## Checks

- `npm test`: tamam 20 tests pass hue, jisme steel spec rules, stock buckets, mass UOM conversion, incompatible UOM, MRP aur procurement domain tests shamil hain.
- `npx prisma validate --schema prisma/schema.prisma`: pass.
- `git diff --check`: pass.
- Prisma Client generation Windows par locked `query_engine-windows.dll.node` ki wajah se fail hua (`EPERM rename`). Isliye `npx tsc --noEmit` Prisma client types load na hone ki wajah se bahut se project-wide errors dikhata hai; is output se naye schema ke saath full typecheck ki pushti nahi hoti. Kisi chalti dev process ko terminate nahi kiya.
- Migration deploy ya live database integration test nahi chalaya gaya.

## Deployment ke baad

Prisma Client regenerate karke TypeScript/build check chalayein; phir migration deploy karein aur ek test receipt ke saath accepted-only, rejected-only aur mixed accepted/rejected cases verify karein. Production ke pehle multi-batch job consumption aur inventory costing policy par kaam baaki hai.
