import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@betterdata/app-api", () => ({
  convexApi: {
    admin: { getPurchaseOutageStatus: "getPurchaseOutageStatus" },
  },
}));

import { OutageBanner } from "@/app/components/OutageBanner";

describe("OutageBanner", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("renders nothing while the status query is loading", () => {
    useQueryMock.mockReturnValue(undefined);
    const { container } = render(<OutageBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when purchases are available", () => {
    useQueryMock.mockReturnValue({ isActive: false, message: "" });
    const { container } = render(<OutageBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the outage alert with the custom message when active", () => {
    useQueryMock.mockReturnValue({
      isActive: true,
      message: "Vendor top-up in progress.",
    });

    render(<OutageBanner />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Purchases are paused")).toBeInTheDocument();
    expect(screen.getByText("Vendor top-up in progress.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage availability/i }),
    ).toHaveAttribute("href", "/outage");
  });

  it("omits the message paragraph when no message is configured", () => {
    useQueryMock.mockReturnValue({ isActive: true, message: "" });
    render(<OutageBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Vendor top-up in progress.")).not.toBeInTheDocument();
  });
});
