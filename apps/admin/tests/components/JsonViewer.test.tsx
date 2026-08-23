import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonViewer } from "@/app/components/JsonViewer";

describe("JsonViewer", () => {
  it("pretty-prints objects with stable indentation", () => {
    render(<JsonViewer value={{ network: "mtn", sizeMb: 1024 }} />);

    expect(screen.getByText(/"network": "mtn"/)).toBeInTheDocument();
    expect(screen.getByText(/"sizeMb": 1024/)).toBeInTheDocument();
  });

  it("renders the optional label", () => {
    render(<JsonViewer value={{}} label="Metadata Payload" />);
    expect(screen.getByText("Metadata Payload")).toBeInTheDocument();
  });

  it("offers a copy action for serializable values", () => {
    render(<JsonViewer value={{ ok: true }} />);
    expect(screen.getByRole("button", { name: /copy json/i })).toBeInTheDocument();
  });

  it("renders string values verbatim without JSON quoting", () => {
    render(<JsonViewer value="plain text" />);
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });
});
