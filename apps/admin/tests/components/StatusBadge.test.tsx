import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "@/app/components/StatusBadge";

function renderBadge(status: string, label?: string | undefined) {
  return render(
    <StatusBadge status={status} {...(label !== undefined ? { label } : {})} />,
  );
}

describe("StatusBadge", () => {
  it("renders the status text by default", () => {
    renderBadge("completed");
    expect(screen.getByText("completed")).toHaveAttribute(
      "data-slot",
      "badge",
    );
  });

  it("prefers a custom label when provided", () => {
    renderBadge("failed", "Suspended");
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.queryByText("failed")).not.toBeInTheDocument();
  });

  it.each([
    ["completed", /bg-\[var\(--success\)\]/],
    ["approved", /bg-\[var\(--success\)\]/],
    ["pending", /bg-\[var\(--warning\)\]/],
    ["failed", /bg-destructive/],
    ["critical", /bg-destructive/],
    ["processing", /bg-\[var\(--info\)\]/],
  ])("maps %s to its tone variant", (status, expectedClass) => {
    const { container } = renderBadge(status);
    expect(container.firstElementChild?.className).toMatch(expectedClass);
  });

  it("falls back to the muted outline tone for unknown statuses", () => {
    const { container } = renderBadge("mystery");
    expect(container.firstElementChild?.className).toMatch(/border-border/);
    expect(container.firstElementChild?.className).toMatch(/bg-muted/);
  });
});
