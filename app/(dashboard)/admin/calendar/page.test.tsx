import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create as closuresCreate } from "@/convex/closures";

// Drive useQuery by function name; closures.create is the only mutation used.
const queries = new Map<string, unknown>();
const create = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    queries.get(getFunctionName(ref)),
  useMutation: () => create,
}));

import SchoolCalendarPage from "./page";

// The argument names closures.create's validator accepts. Convex rejects any
// extra field with ArgumentValidationError, so every call must stay inside it.
const declaredArgs = Object.keys(
  JSON.parse(
    (closuresCreate as unknown as { exportArgs(): string }).exportArgs(),
  ).value,
);

// jsdom has no ResizeObserver; Radix Checkbox measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  queries.set("users:getMe", { role: "admin", isActive: true });
  queries.set("academicYears:list", [
    { _id: "y1", name: "2026", startDate: 0, endDate: 1e15 },
  ]);
  queries.set("campus:list", [
    { _id: "c1", name: "Campus A" },
    { _id: "c2", name: "Campus B" },
  ]);
  queries.set("closures:list", []);
});
afterEach(() => vi.clearAllMocks());

describe("/admin/calendar add closure", () => {
  it("confirming a void re-sends only the declared closure args", async () => {
    create
      .mockResolvedValueOnce({
        ok: false,
        needsConfirmation: true,
        markCount: 87,
        classCount: 4,
      })
      .mockResolvedValueOnce({ ok: true, created: 1 });

    render(<SchoolCalendarPage />);
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-04-12" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Hartal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add closure" }));

    expect(
      await screen.findByText("This day already has marks"),
    ).toBeInTheDocument();
    expect(screen.getByText(/87 marks across 4 classes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));

    const [first, second] = create.mock.calls.map((c) => c[0]);
    expect(first).toEqual({
      startDate: "2026-04-12",
      endDate: "2026-04-12",
      reason: "Hartal",
      campuses: ["c1", "c2"],
      confirmVoid: false,
    });
    expect(second).toEqual({ ...first, confirmVoid: true });
    for (const call of [first, second])
      for (const key of Object.keys(call)) expect(declaredArgs).toContain(key);
  });
});
