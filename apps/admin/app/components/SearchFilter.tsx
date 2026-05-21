import React, { useEffect, useState } from "react";

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

export function SearchFilter({
  placeholder = "Search...",
  search,
  onSearchChange,
  filters,
  onClear,
}: SearchFilterProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, onSearchChange]);

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
        <input
          type="text"
          className="input"
          placeholder={placeholder}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>

      {filters.map((filter) => (
        <div key={filter.key} style={{ minWidth: "150px" }}>
          <select
            className="select"
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
          >
            <option value="">All {filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

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
