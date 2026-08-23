"use client";

import React, { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterSpec = {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
};

type SearchFilterProps = {
  placeholder?: string;
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterSpec[];
  onClear: () => void;
};

// Sentinel for the "All ..." option — Radix Select forbids empty-string item values,
// so the public FilterSpec API keeps "" as "no filter" and we translate at the boundary.
function allValueFor(filterKey: string) {
  return `__all__:${filterKey}`;
}

export function SearchFilter({
  placeholder = "Search...",
  search,
  onSearchChange,
  filters,
  onClear,
}: SearchFilterProps) {
  const [localSearch, setLocalSearch] = useState(search);
  // Last value we actually reported to the parent (null = nothing fired yet).
  const lastFiredRef = useRef<string | null>(null);

  // Keep local input in sync when the parent resets/changes the search externally.
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search input (400ms).
  useEffect(() => {
    const handler = setTimeout(() => {
      // Skip no-op firings: value already reported, or identical to the incoming
      // prop (covers initial mount and prevents parent->child->parent loops).
      if (lastFiredRef.current === localSearch || localSearch === search) {
        return;
      }
      lastFiredRef.current = localSearch;
      onSearchChange(localSearch);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, search, onSearchChange]);

  const hasActiveFilters = search || filters.some((f) => f.value !== "");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        alignItems: "center",
        marginBottom: "var(--space-4)",
      }}
    >
      <div style={{ flex: "1 1 240px" }}>
        <Input
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>

      {filters.map((filter) => {
        const allValue = allValueFor(filter.key);
        return (
          <div key={filter.key} style={{ minWidth: "150px" }}>
            <Select
              value={filter.value === "" ? allValue : filter.value}
              onValueChange={(next) => filter.onChange(next === allValue ? "" : next)}
            >
              <SelectTrigger className="w-full" aria-label={`Filter by ${filter.label}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allValue}>All {filter.label}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      {hasActiveFilters && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setLocalSearch("");
            onClear();
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
