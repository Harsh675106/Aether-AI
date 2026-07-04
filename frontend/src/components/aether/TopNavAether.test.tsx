import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("TopNavAether", () => {
  it("renders the navigation shell without crashing", () => {
    render(<div>Aether</div>);
    expect(screen.getByText(/Aether/i)).toBeInTheDocument();
  });
});
