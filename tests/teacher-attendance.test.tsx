import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { AttendanceClass } from "@/features/teacher/attendance";
import { ServicesProvider } from "@/hooks/use-services";
import { SCREENS } from "@/config/screens";
import { createMockServices } from "@/services/mock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setup() {
  const services = createMockServices();
  const screen_ = SCREENS.find((s) => s.id === "teacher-attendance-class")!;
  render(
    <ServicesProvider services={services}>
      <ToastProvider>
        <AttendanceClass screen={screen_} params={{ classId: "8A" }} />
      </ToastProvider>
    </ServicesProvider>,
  );
  return services;
}

describe("Teacher attendance (simple daily task)", () => {
  it("starts with everyone present, so only exceptions need a tap", async () => {
    setup();
    await screen.findByText(/Attendance · Class 8A/);
    const present = screen
      .getAllByRole("radio", { name: /Present/ })
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(present).toHaveLength(14);
  });

  it("counts change as the teacher marks an absence, then submits after confirming", async () => {
    const user = userEvent.setup();
    const services = setup();
    await screen.findByText(/Attendance · Class 8A/);
    const firstGroup = screen.getAllByRole("radiogroup")[0]!;
    await user.click(within(firstGroup).getByRole("radio", { name: /Absent/ }));
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit attendance" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/13 present, 1 absent, 0 late/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Yes, submit" }));

    await waitFor(async () =>
      expect((await services.attendance.getSheet("8A", "2026-10-26"))?.status).toBe("submitted"),
    );
    expect(await screen.findByText("Attendance has been recorded.")).toBeInTheDocument();
    expect(screen.getByText(/development mock only/i)).toBeInTheDocument();
  });
});
