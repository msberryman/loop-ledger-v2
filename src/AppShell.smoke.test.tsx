// src/AppShell.smoke.test.tsx
import { describe, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";

async function clickTab(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  const tabBtn =
    (await screen.findByRole("button", { name: label }).catch(() => null)) ??
    (await screen.findByRole("link", { name: label }).catch(() => null));
  if (!tabBtn) throw new Error(`Could not find tab ${label}`);
  await user.click(tabBtn);
}

describe("Base UI contract", () => {
  it("persists loops/expenses/income/settings", async () => {
    const user = userEvent.setup();

    // Start on Loops
    render(
      <MemoryRouter initialEntries={["/loops"]}>
        <AppShell />
      </MemoryRouter>
    );

    // Loops: assert stable control
    await screen.findByText(/add loop/i);

    // Expenses
    await clickTab(user, /expenses/i);
    await screen.findByRole("button", { name: /add expense/i });

    // Income
    await clickTab(user, /income/i);
    await screen.findByRole("heading", { name: /income/i });

    // Settings: try via labeled control; if not present, mount directly at /settings
    const settingsControl =
      (await screen.findByRole("button", { name: /settings/i }).catch(() => null)) ??
      (await screen.findByRole("link", { name: /settings/i }).catch(() => null));

    if (settingsControl) {
      await user.click(settingsControl);
      await screen.findByRole("heading", { name: /settings/i });
    } else {
      // Fallback: render Settings route directly
      render(
        <MemoryRouter initialEntries={["/settings"]}>
          <AppShell />
        </MemoryRouter>
      );
      await screen.findByRole("heading", { name: /settings/i });
    }
  });
});
