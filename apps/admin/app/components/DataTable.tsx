"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  const isClickable = !!onRowClick;

  if (isLoading) {
    return (
      <div className="table-shell">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.hiddenOnMobile && "hidden md:table-cell")}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rIdx) => (
              <TableRow key={rIdx}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.hiddenOnMobile && "hidden md:table-cell"
                    )}
                  >
                    <Skeleton className="h-3.5 w-[60%]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
            aria-hidden="true"
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

  return (
    <div className="table-shell">
      <Table
        className={cn(isClickable && "[&_tbody_tr]:cursor-pointer select-none")}
      >
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(col.hiddenOnMobile && "hidden md:table-cell")}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={rowKey(row)}
              tabIndex={isClickable ? 0 : undefined}
              role={isClickable ? "button" : undefined}
              onClick={() => onRowClick && onRowClick(row)}
              onKeyDown={
                isClickable
                  ? (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick?.(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    col.hiddenOnMobile && "hidden md:table-cell"
                  )}
                >
                  {col.render
                    ? col.render(row)
                    : ((row[col.key as keyof T] ?? null) as React.ReactNode)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
