import React from "react";

export type ColumnDef<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  hiddenOnMobile?: boolean;
};

type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data?: T[];
  isLoading?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
};

export function DataTable<T>({
  columns,
  data = [],
  isLoading = false,
  emptyStateTitle = "No data found",
  emptyStateDescription = "There are no records matching your query.",
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.hiddenOnMobile ? "hidden-mobile" : ""}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rIdx) => (
              <tr key={rIdx}>
                {columns.map((col) => (
                  <td key={col.key} className={col.hiddenOnMobile ? "hidden-mobile" : ""}>
                    <div className="skeleton skeleton-text" style={{ width: "60%" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-shell">
        <div className="empty-state">
          <svg
            className="empty-state-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
          <div className="empty-state-title">{emptyStateTitle}</div>
          <div className="empty-state-description">{emptyStateDescription}</div>
        </div>
      </div>
    );
  }

  const isClickable = !!onRowClick;

  return (
    <div className="table-shell">
      <table className={`table${isClickable ? " table-clickable" : ""}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.hiddenOnMobile ? "hidden-mobile" : ""}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.hiddenOnMobile ? "hidden-mobile" : ""}>
                  {col.render ? col.render(row) : (row[col.key as keyof T] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
