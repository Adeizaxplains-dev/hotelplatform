import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/feedback/ErrorState";
import { StatusBadge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";

describe("Button", () => {
  it("is type=button by default so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("blocks clicks and announces busy while loading (no double submit)", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("associates the label, hint and error with the control", () => {
    render(<Input label="Email" required hint="We never share it." error="Enter a valid email." />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("We never share it. Enter a valid email.");
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("shows a text label (and an icon), so status is not conveyed by colour alone", () => {
    const { container } = render(<StatusBadge tone="danger">Cancelled</StatusBadge>);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("ErrorState", () => {
  it("offers a retry and uses plain language", async () => {
    const onRetry = vi.fn();
    render(<ErrorState description="We couldn't load your reservations." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
