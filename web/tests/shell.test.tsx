import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { AppShell } from "@/components/app-shell";

describe("M0 shell", () => {
  it("provides an accessible preview and disables unfinished workflows", () => {
    render(
      <AppShell>
        <HomePage />
      </AppShell>,
    );
    expect(
      screen.getByRole("heading", {
        name: "Welcome to Isna Finance",
        level: 1,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    for (const label of ["Main navigation", "Mobile navigation"]) {
      const nav = within(screen.getByRole("navigation", { name: label }));
      expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
        "href",
        "/",
      );
      for (const name of ["Orders", "Quick Order", "Activity", "More"]) {
        expect(
          nav.getByRole("button", { name: `${name} (coming soon)` }),
        ).toBeDisabled();
      }
    }
    expect(screen.getByText(/Recording is not available yet/)).toBeVisible();
  });
});
