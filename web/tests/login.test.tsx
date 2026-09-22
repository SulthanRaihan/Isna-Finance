import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/auth-actions", () => ({
  login: vi.fn().mockResolvedValue({ error: "Login tidak berhasil." }),
}));
import { LoginForm } from "@/components/login-form";
describe("login form", () => {
  it("labels fields and toggles password visibility without signup", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Kata sandi")).toHaveAttribute(
      "type",
      "password",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tampilkan kata sandi" }),
    );
    expect(screen.getByLabelText("Kata sandi")).toHaveAttribute("type", "text");
    expect(
      screen.queryByRole("link", { name: /daftar|signup/i }),
    ).not.toBeInTheDocument();
  });
  it("disables login when configuration is missing", () => {
    render(<LoginForm disabled />);
    expect(
      screen.getByRole("button", { name: "Masuk ke ruang kerja" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Login sedang disiapkan",
    );
  });
});
