import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/auth-actions", () => ({ logout: vi.fn() }));
import { AppShell } from "@/components/app-shell";

describe("Application shell", () => {
  it("provides accessible navigation and daily recap", () => {
    render(
      <AppShell>
        <h1>Ringkasan harian</h1>
      </AppShell>,
    );
    expect(
      screen.getByRole("heading", {
        name: "Ringkasan harian",
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
      expect(nav.getByRole("link", { name: "More" })).toHaveAttribute(
        "href",
        "/more",
      );
      expect(nav.getByRole("link", { name: "Activity" })).toHaveAttribute(
        "href",
        "/activity",
      );
    }
    expect(screen.getByRole("link", { name: "Daily Recap" })).toHaveAttribute(
      "href",
      "/recaps",
    );
  });
});
