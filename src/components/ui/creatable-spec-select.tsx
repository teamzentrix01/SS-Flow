"use client";

import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { ChevronDown, Plus, Search, Check, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "@/components/toast";

export type SpecOption = {
  id?: string;
  value: string;
  label?: string;
  unit?: string | null;
};

export type CreatableSpecSelectProps = {
  fieldName: string;
  fieldLabel?: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | SpecOption)[];
  placeholder?: string;
  disabled?: boolean;
  canCreate?: boolean;
  permissionHint?: string;
  categoryId?: string;
  productId?: string;
  className?: string;
  ariaLabel?: string;
  onOptionAdded?: (option: SpecOption) => void;
};

const NUMERIC_FIELDS = new Set([
  "thickness",
  "width",
  "length",
  "diameter",
  "size",
  "height",
  "capacityLitres",
  "innerDiameter",
  "outerDiameter",
  "wireGauge",
  "wireDiameterMm",
  "cutLengthMm",
  "innerDiameterMm",
  "outerDiameterMm",
  "weightPerPiece",
  "netWeightKg",
  "breadth",
]);

function isNumericField(fieldName: string): boolean {
  return NUMERIC_FIELDS.has(fieldName);
}

function normalize(val: unknown): string {
  if (val == null) return "";
  const str = typeof val === "string" ? val : String(val);
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Natural comparison:
 * - Purely numeric values sorted by number ascending
 * - Grades sorted naturally (201, 304, 316, 430)
 * - Strings sorted alphabetically
 */
function compareSpecOptions(a: string, b: string, fieldName: string): number {
  if (isNumericField(fieldName)) {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function CreatableSpecSelect({
  fieldName,
  fieldLabel,
  unit,
  value,
  onChange,
  options: rawOptions,
  placeholder,
  disabled = false,
  canCreate = true,
  permissionHint = "Ask an admin to add this",
  categoryId,
  productId,
  className = "",
  ariaLabel,
  onOptionAdded,
}: CreatableSpecSelectProps) {
  const selectId = useId();
  const label = fieldLabel || fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replaceAll(/([A-Z])/g, " $1");
  const isNumeric = isNumericField(fieldName);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createdOptions, setCreatedOptions] = useState<SpecOption[]>([]);

  // Listen to cross-component update events
  useEffect(() => {
    function handleSpecUpdated(e: Event) {
      const customEvent = e as CustomEvent<{ fieldName: string; option: SpecOption }>;
      if (customEvent.detail && customEvent.detail.fieldName === fieldName) {
        const newOpt = customEvent.detail.option;
        setCreatedOptions((prev) => {
          const exists = prev.some((p) => normalize(p.value) === normalize(newOpt.value));
          if (!exists) return [...prev, newOpt];
          return prev;
        });
      }
    }
    window.addEventListener("spec-options-updated", handleSpecUpdated);
    return () => window.removeEventListener("spec-options-updated", handleSpecUpdated);
  }, [fieldName]);

  // Modal / Inline Add State
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addError, setAddError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Normalize all options to { value, label } and sort them
  const formattedOptions = useMemo(() => {
    const map = new Map<string, SpecOption>();
    const allOptions = [...rawOptions, ...createdOptions];
    for (const opt of allOptions) {
      if (opt == null) continue;
      const rawVal = typeof opt === "object" && opt !== null && "value" in opt ? (opt as SpecOption).value : opt;
      const v = typeof rawVal === "string" ? rawVal : String(rawVal ?? "");
      const rawLabel = typeof opt === "object" && opt !== null && "label" in opt ? (opt as SpecOption).label : undefined;
      const l = rawLabel || (unit && isNumeric ? `${v} ${unit}` : v);
      if (!v.trim()) continue;
      const norm = normalize(v);
      if (!map.has(norm)) {
        map.set(norm, {
          id: typeof opt === "object" && opt !== null && "id" in opt ? (opt as SpecOption).id : undefined,
          value: v.trim(),
          label: String(l).trim(),
          unit: typeof opt === "object" && opt !== null && "unit" in opt ? (opt as SpecOption).unit : unit,
        });
      }
    }

    // Keep legacy/saved free-text value visible even if not in original options
    const strVal = typeof value === "string" ? value : String(value ?? "");
    if (strVal && strVal.trim()) {
      const trimmedVal = strVal.trim();
      const normVal = normalize(trimmedVal);
      if (!map.has(normVal)) {
        map.set(normVal, {
          value: trimmedVal,
          label: unit && isNumeric ? `${trimmedVal} ${unit}` : trimmedVal,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => compareSpecOptions(a.value, b.value, fieldName));
  }, [rawOptions, createdOptions, value, unit, isNumeric, fieldName]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const q = normalize(search);
    if (!q) return formattedOptions;
    return formattedOptions.filter((opt) => normalize(opt.value).includes(q) || normalize(opt.label || "").includes(q));
  }, [formattedOptions, search]);

  const hasExactMatch = useMemo(() => {
    const q = normalize(search);
    if (!q) return false;
    return formattedOptions.some((opt) => normalize(opt.value) === q);
  }, [formattedOptions, search]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Auto focus search when dropdown opens
  useEffect(() => {
    if (isOpen && !isAdding) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isAdding]);

  // Auto focus input when add form opens
  useEffect(() => {
    if (isAdding) {
      setTimeout(() => {
        addInputRef.current?.focus();
      }, 50);
    }
  }, [isAdding]);

  const handleOpenAdd = (prefill = "") => {
    if (!canCreate) return;
    setNewValue(prefill.trim() || search.trim());
    setNewDesc("");
    setAddError("");
    setIsAdding(true);
  };

  const handleSaveNewOption = async () => {
    setAddError("");
    const trimmed = newValue.trim();

    if (!trimmed) {
      setAddError(`${label} is required.`);
      return;
    }

    if (trimmed.length > 80) {
      setAddError(`${label} cannot exceed 80 characters.`);
      return;
    }

    if (isNumeric) {
      const num = Number(trimmed);
      if (isNaN(num) || num <= 0 || !/^\d+(\.\d{1,3})?$/.test(trimmed)) {
        setAddError(`Please enter a valid positive number (up to 3 decimal places).`);
        return;
      }
    }

    // Check duplicate in existing options (case-insensitive)
    const norm = normalize(trimmed);
    const existing = formattedOptions.find((opt) => normalize(opt.value) === norm);
    if (existing) {
      // Auto-select existing option without redundant API call
      onChange(existing.value);
      setIsAdding(false);
      setIsOpen(false);
      setSearch("");
      toast.info(`Selected existing ${label.toLowerCase()} "${existing.value}".`);
      return;
    }

    setIsPending(true);
    try {
      const payload: Record<string, unknown> = {
        fieldName,
        value: trimmed,
        unit: unit || undefined,
        description: newDesc.trim() || undefined,
        categoryId: categoryId || undefined,
        productId: productId || undefined,
      };

      const res = await fetch("/api/v1/masters/spec-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to create ${label.toLowerCase()}.`);
      }

      const createdOpt: SpecOption = {
        id: data.data?.option?.id || data.option?.id,
        value: data.data?.option?.value || data.option?.value || trimmed,
        label: data.data?.option?.label || data.option?.label || (unit && isNumeric ? `${trimmed} ${unit}` : trimmed),
        unit: data.data?.option?.unit || data.option?.unit || unit,
      };

      // Add to local state & select it immediately
      setCreatedOptions((prev) => [...prev, createdOpt]);
      onChange(createdOpt.value);
      onOptionAdded?.(createdOpt);

      // Broadcast event so other spec dropdowns on the screen see the new option
      window.dispatchEvent(
        new CustomEvent("spec-options-updated", {
          detail: { fieldName, option: createdOpt },
        })
      );

      toast.success(`${label} "${createdOpt.value}" saved successfully.`);
      setIsAdding(false);
      setIsOpen(false);
      setSearch("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : `Failed to save ${label.toLowerCase()}.`);
    } finally {
      setIsPending(false);
    }
  };

  const selectedDisplayLabel = useMemo(() => {
    if (!value) return null;
    const match = formattedOptions.find((opt) => opt.value === value);
    if (match) return match.label || match.value;
    return unit && isNumeric ? `${value} ${unit}` : value;
  }, [value, formattedOptions, unit, isNumeric]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Combobox Trigger Button */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || `Select ${label}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setIsAdding(false);
          }
        }}
        className={`flex h-11 w-full items-center justify-between rounded-[10px] border border-border bg-card px-3 text-left text-sm text-foreground transition outline-none focus-visible:border-info focus-visible:ring-2 focus-visible:ring-info/25 ${
          disabled ? "cursor-not-allowed opacity-60 bg-muted/20" : "cursor-pointer hover:border-border/80"
        }`}
      >
        <span className={`truncate ${!selectedDisplayLabel ? "text-muted/70" : "font-medium text-foreground"}`}>
          {selectedDisplayLabel || placeholder || `Select ${label}…`}
        </span>
        <div className="flex items-center gap-1.5 pl-2 text-muted shrink-0">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="rounded p-0.5 hover:bg-muted/30 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in zoom-in-95">
          {!isAdding ? (
            <>
              {/* Search Box */}
              <div className="relative mb-1 px-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsOpen(false);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredOptions.length === 1) {
                        onChange(filteredOptions[0].value);
                        setIsOpen(false);
                      } else if (!hasExactMatch && search.trim() && canCreate) {
                        handleOpenAdd(search.trim());
                      }
                    }
                  }}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-2 text-xs text-foreground outline-none focus:border-info focus:ring-1 focus:ring-info"
                />
              </div>

              {/* Options List */}
              <ul
                role="listbox"
                aria-label={label}
                className="max-h-52 overflow-y-auto overscroll-contain py-1 text-sm divide-y divide-border/20"
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                          isSelected
                            ? "bg-info/10 font-semibold text-info"
                            : "text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <span className="truncate">{opt.label || opt.value}</span>
                        {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-info" /> : null}
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-2 text-center text-xs text-muted">
                    No matching {label.toLowerCase()} found.
                  </li>
                )}
              </ul>

              {/* Bottom Action: + Add New Option */}
              <div className="mt-1 border-t border-border pt-1">
                {canCreate ? (
                  <button
                    type="button"
                    onClick={() => handleOpenAdd()}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-info hover:bg-info/10 transition"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {!hasExactMatch && search.trim()
                        ? `Add "${search.trim()}"`
                        : `+ Add new ${label.toLowerCase()}`}
                    </span>
                  </button>
                ) : (
                  <div
                    title={permissionHint}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-muted bg-muted/10 cursor-not-allowed opacity-75"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      + Add new {label.toLowerCase()}
                    </span>
                    <span className="text-[10px] font-normal italic text-muted-foreground ml-1 shrink-0">
                      (Ask an admin to add this)
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Inline Add Dialog */
            <div className="p-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  New {label}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded p-0.5 text-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted block mb-1">
                  {label} {unit ? `(${unit})` : ""} <span className="text-danger">*</span>
                </label>
                <input
                  ref={addInputRef}
                  type={isNumeric ? "number" : "text"}
                  min={isNumeric ? "0.001" : undefined}
                  step={isNumeric ? "any" : undefined}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveNewOption();
                    } else if (e.key === "Escape") {
                      setIsAdding(false);
                    }
                  }}
                  placeholder={isNumeric ? `e.g. 1.5` : `e.g. SS 310`}
                  className="h-8 w-full rounded-lg border border-border bg-card px-2.5 text-xs text-foreground outline-none focus:border-info focus:ring-1 focus:ring-info"
                />
              </div>

              {!isNumeric ? (
                <div>
                  <label className="text-[11px] font-medium text-muted block mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSaveNewOption();
                      } else if (e.key === "Escape") {
                        setIsAdding(false);
                      }
                    }}
                    placeholder="Specification notes…"
                    className="h-8 w-full rounded-lg border border-border bg-card px-2.5 text-xs text-foreground outline-none focus:border-info focus:ring-1 focus:ring-info"
                  />
                </div>
              ) : null}

              {addError ? (
                <div className="flex items-start gap-1 rounded bg-danger/10 p-1.5 text-[11px] text-danger">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsAdding(false)}
                  className="h-7 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted/40 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void handleSaveNewOption()}
                  className="flex h-7 items-center gap-1 rounded-md bg-info px-3 text-xs font-medium text-white hover:bg-info/90 transition disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
