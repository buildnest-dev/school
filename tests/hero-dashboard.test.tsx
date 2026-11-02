import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HeroDashboard } from "@/components/landing/hero-dashboard";

describe("HeroDashboard (illustrative workspace switcher)", () => {
  it("starts on Northfield Academy with its sample figures", () => {
    render(<HeroDashboard />);
    expect(screen.getAllByText("Northfield Academy").length).toBeGreaterThan(0);
    expect(screen.getByText("1,248")).toBeInTheDocument();
  });

  it("switches the sample workspace and updates the figures", async () => {
    const user = userEvent.setup();
    render(<HeroDashboard />);
    await user.click(screen.getByRole("button", { name: "Riverstone Public School" }));
    expect(screen.getByRole("button", { name: "Riverstone Public School" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("862")).toBeInTheDocument();
    expect(screen.getByText("Nursery–10 · 27 sections")).toBeInTheDocument();
  });

  it("toggles the group view with consolidated campuses", async () => {
    const user = userEvent.setup();
    render(<HeroDashboard />);
    await user.click(screen.getByRole("button", { name: "Group view" }));
    expect(screen.getByText("Lakeview Junior Campus")).toBeInTheDocument();
    expect(screen.getByText("Consolidated, read-only view")).toBeInTheDocument();
  });
});
