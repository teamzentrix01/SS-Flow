# Two-Factory Inventory, Stock Transfers & Plant-Level Access Control Audit Report

## Executive Summary

The SS-Metals ERP has a solid foundation for factory-scoped inventory through `UserPlantAccess`, `plantId` associations on all inventory models, and plant-filtered queries. However, **inter-factory stock transfers are completely missing**. The current "transfer" feature only moves stock between locations within the same factory, not between different factories. Additionally, the GRN receiving factory is not separated from the PO's intended factory, which could lead to inventory tracking inconsistencies.

## Schema Audit - Plant/Factory Associations

### ✅ CORRECTLY IMPLEMENTED

All inventory-related models have proper `plantId` associations:

- **MaterialBatch**: `plantId` (required), unique constraint on `[plantId, batchNo]`
- **StockBalance**: `plantId` (required), indexed by `plantId`
- **StockLedger**: `plantId` (required), indexed by `[plantId, createdAt]`
- **PurchaseOrder**: `plantId` (required), unique constraint on `[plantId, number]`
- **GoodsReceipt**: `plantId` (required), unique constraint on `[plantId, number]`
- **GoodsReceiptItem**: No `plantId` (inherits via receipt - CORRECT)
- **QcInspection**: `plantId` (required)
- **UserPlantAccess**: Links users to plants via composite key `[userId, plantId]`

### ⚠️ POTENTIAL ISSUES

1. **MaterialBatch.locationId**: This field exists but is NOT authoritative for multi-location stock. The `StockBalance` table with unique `[batchId, locationId]` is the source of truth for location-specific balances. This is correctly documented in the existing audit.

2. **GoodsReceipt plantId**: Always set to the actual receiving factory during receipt creation. There is NO separate field to track the PO's intended factory.

## Gap Analysis

### 1. Factory-Scoped Inventory

**Status**: ✅ PARTIALLY CORRECT

**What Works:**
- All stock balances are stored with `plantId`
- Stock ledger entries have `plantId`
- All queries use `plantId in plantIds` filtering
- Dashboard data is scoped to user's `plantIds`
- Access control via `UserPlantAccess` and `plantIdsForSession`

**What's Missing:**
- No verification that historical records without `plantId` are properly assigned
- No report to identify orphaned inventory records

**Severity**: LOW - The system appears to enforce plantId on all new records.

### 2. Inter-Factory Stock Transfer

**Status**: ❌ NOT IMPLEMENTED

**Current State:**
- The existing `transferStock` command in `src/lib/commands.ts` ONLY supports transfers between locations within the SAME plant
- Validation checks: `warehouse: { plantId }` for both source and destination locations
- This prevents cross-factory transfers entirely
- No `StockTransfer` model exists in the schema
- No transfer status tracking (draft, approved, in_transit, received)
- No distinction between "same-factory location transfer" and "cross-factory transfer"

**Required Implementation:**
1. Create `StockTransfer` model with:
   - Source plant, destination plant
   - Transfer status (draft → approved → in_transit → received/cancelled)
   - Requested, dispatched, received quantities
   - Rejected/damaged quantities
   - Approval, dispatch, receipt timestamps and actors
   - Link to source batch and material
   - In-transit stock bucket in `StockBalance`

2. Create transfer-specific movement types in ledger:
   - `inter_factory_dispatch_out` (deducts from source plant available)
   - `inter_factory_dispatch_in` (adds to source plant in-transit)
   - `inter_factory_receive_in` (adds to destination plant available)
   - `inter_factory_reject` (records loss/damage)

3. Implement transfer commands:
   - `createTransfer` - Draft transfer request
   - `approveTransfer` - Approve and dispatch
   - `receiveTransfer` - Receive at destination with partial acceptance/rejection
   - `cancelTransfer` - Cancel if not yet dispatched

4. Add transfer-specific validation:
   - Source and destination must be different plants
   - Check sufficient available stock at source plant
   - Prevent concurrent oversubscription
   - Require permissions for both source and destination operations

**Severity**: HIGH - This is a complete missing feature required for two-factory inventory management.

### 3. PO Factory vs GRN Receiving Factory

**Status**: ⚠️ PARTIALLY CORRECT

**Current State:**
- PO has `plantId` (intended receiving factory)
- GRN has `plantId` (actual receiving factory)
- These are separate fields, which is correct
- **BUT**: There is NO validation or flagging when they differ
- GRN posting validates that the PO exists but does NOT check factory match
- No alert or approval workflow for factory mismatches
- No way to see "PO intended factory: Factory A, actual receiving factory: Factory B"

**Required Implementation:**
1. Add `intendedPlantId` field to `GoodsReceipt` (nullable)
2. On GRN creation, auto-populate `intendedPlantId` from PO's `plantId`
3. Add validation: if `receivingPlantId != intendedPlantId`, require special permission or flag
4. Update UI to show both factories when they differ
5. Add audit logging for factory mismatches
6. Consider requiring explicit confirmation or authorization for factory mismatches

**Severity**: MEDIUM - The data exists but there's no business logic to handle mismatches.

### 4. Factory-Level Access Control

**Status**: ✅ MOSTLY CORRECT

**What Works:**
- `UserPlantAccess` table correctly maps users to plants
- `plantIdsForSession` returns user's assigned plants (or all for admins)
- `requirePage` checks permissions and redirects unauthorized users
- `assertPlant` validates plant access for specific operations
- All admin pages use `plantIdsForSession(session.plantIds)` to scope queries
- `primaryPlant(session)` throws error if user has no plant assignment

**What Needs Verification:**
- Ensure no endpoint bypasses `plantIdsForSession` and directly queries all plants
- Check bulk operations, exports, and reports for plant scoping
- Verify that cross-factory operations (when implemented) check both source and destination access

**Severity**: LOW - The implementation appears sound but needs verification.

### 5. Ledger Integrity and Balance Consistency

**Status**: ✅ CORRECT

**What Works:**
- Every stock movement creates a `StockLedger` entry with `plantId`
- `postMovement` function atomically updates `StockBalance` and creates ledger entry
- Ledger has `referenceType`, `referenceId`, `referenceLineId` for traceability
- Movement types include: receipt, receipt_reject, qc_release, qc_reject, reserve, unreserve, issue, return, consume, output, finish_release, scrap, reject_output, dispatch, adjust, transfer_out, transfer_in
- The system uses ledger-derived calculations rather than cached sums

**What's Missing:**
- No ledger reconciliation function to detect balance/ledger mismatches
- No in-transit bucket for cross-factory transfers (when implemented)

**Severity**: LOW - The current design is sound. Reconciliation function would be nice but not critical.

## Implementation Priority

### Priority 1: Inter-Factory Stock Transfer (HIGH)

This is the biggest gap - the system cannot transfer stock between factories at all.

**Required Changes:**
1. Create `StockTransfer` model in Prisma schema
2. Add in-transit bucket to `StockBalance`
3. Implement transfer status workflow
4. Create transfer commands with proper validation
5. Add transfer-specific ledger movement types
6. Create transfer UI (create, approve, dispatch, receive)
7. Add transfer list/history page

### Priority 2: PO vs GRN Factory Mismatch Handling (MEDIUM)

**Required Changes:**
1. Add `intendedPlantId` to `GoodsReceipt` model
2. Create migration for the new field
3. Update GRN creation to copy PO's plantId
4. Add validation/flagging for factory mismatches
5. Update UI to display both factories
6. Add audit logging

### Priority 3: Access Control Verification (LOW)

**Required Changes:**
1. Audit all API routes for plant scoping compliance
2. Verify bulk operations and exports
3. Add integration tests for cross-factory operations

### Priority 4: Ledger Reconciliation (LOW)

**Required Changes:**
1. Create reconciliation function to compare ledger sums with balance sums
2. Add reconciliation report page

## Recommended Implementation Plan

Given the scope and the requirement to avoid destructive changes, I recommend:

1. **First**: Implement PO vs GRN factory mismatch handling (smaller change, lower risk)
2. **Second**: Implement inter-factory stock transfer (larger change, higher complexity)
3. **Third**: Add comprehensive tests
4. **Fourth**: Create transfer UI
5. **Fifth**: Verification and final report

## Conclusion

The SS-Metals ERP has a good foundation for factory-scoped inventory but is **missing the critical inter-factory stock transfer feature**. The current "transfer" capability is misnamed - it's actually intra-factory location transfer. The PO/GRN factory separation exists at the data level but lacks business logic to handle mismatches. Access control appears sound but needs verification.

The system would benefit from implementing true inter-factory transfers with proper status tracking, in-transit inventory management, and atomic transaction safety.
