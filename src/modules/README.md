# Modular monolith layout

Business logic is grouped by domain module. API routes and legacy `src/lib/commands.ts` re-export or call these modules.

| Module | Path | Responsibility |
|--------|------|----------------|
| Sales | `sales/` | Sales orders, lifecycle, status events |
| Planning | `planning/` | MRP calculation, material requirements, reservations |
| Masters | `masters/` | Material/product master CRUD |
| BOM | `bom/` | Bill of materials |
| Procurement | `procurement/` | Requisitions, PO suggestions |
| Inventory | `inventory/` | Reservation helpers (stock posting stays in `lib/inventory/post`) |
| Production | `production/` | Sales-driven production orders |
| Material requests | `material-requests/` | Shop shortage workflow |
| Reports | `reports/` | Aggregated report queries |
| Shared | `shared/` | Cross-module helpers |

Quality, dispatch, and core job execution remain in `src/lib/commands.ts` until further extraction.
