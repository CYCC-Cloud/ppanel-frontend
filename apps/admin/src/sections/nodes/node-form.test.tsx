// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NodeForm from "./node-form";

const mockUseServer = vi.fn();
const mockUseNode = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/stores/server", () => ({
  useServer: () => mockUseServer(),
}));

vi.mock("@/stores/node", () => ({
  useNode: () => mockUseNode(),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({ children, type = "button", ...props }: any) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("@workspace/ui/components/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  SheetFooter: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  SheetHeader: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  SheetTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  SheetTrigger: ({ children }: any) => <>{children}</>,
}));

vi.mock("@workspace/ui/composed/combobox", () => ({
  Combobox: ({ options = [], value, onChange, placeholder }: any) => {
    const selectedValue = value == null ? "" : String(value);

    return (
      <select
        aria-label={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;

          if (nextValue === "") {
            onChange(undefined);
            return;
          }

          const selectedOption = options.find(
            (option: { value: unknown }) => String(option.value) === nextValue
          );

          onChange(selectedOption?.value);
        }}
        value={selectedValue}
      >
        <option value="">{placeholder}</option>
        {options.map((option: { value: string; label: string }) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));

function EnhancedInput({
  onValueChange,
  ref,
  value,
  type = "text",
  ...props
}: any & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      {...props}
      onChange={(event) => {
        const nextValue =
          type === "number" ? Number(event.target.value) : event.target.value;
        onValueChange?.(nextValue);
      }}
      ref={ref}
      type={type}
      value={value ?? ""}
    />
  );
}

vi.mock("@workspace/ui/composed/enhanced-input", () => ({
  EnhancedInput,
}));

vi.mock("@workspace/ui/composed/tag-input", () => ({
  default: ({ value = [] }: { value?: string[] }) => (
    <div data-testid="tag-input">{value.join(",")}</div>
  ),
}));

describe("NodeForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockUseNode.mockReturnValue({ tags: [] });
    mockUseServer.mockReturnValue({
      servers: [
        {
          id: 1,
          name: "Alpha",
          address: "alpha.example.com",
        },
      ],
      getAvailableListeners: vi.fn((serverId?: number) => {
        if (serverId !== 1) return [];

        return [
          {
            listener_key: "listener-a",
            listener_name: "Primary VLESS",
            protocol: "vless",
            port: 443,
          },
          {
            listener_key: "listener-b",
            listener_name: "Fallback Trojan",
            protocol: "trojan",
            port: 8443,
          },
        ];
      }),
    });
  });

  it("submits listener_key and updates protocol and port from the selected listener", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm onSubmit={onSubmit} title="Create Node" trigger="Create" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.change(screen.getByLabelText("Select server…"), {
      target: { value: "1" },
    });

    expect(screen.getByDisplayValue("Primary VLESS | vless:443")).toBeTruthy();
    expect(screen.getByDisplayValue("vless")).toBeTruthy();
    expect(screen.getByDisplayValue("443")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Select listener…"), {
      target: { value: "listener-b" },
    });

    expect(screen.getByDisplayValue("trojan")).toBeTruthy();
    expect(screen.getByDisplayValue("8443")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          server_id: 1,
          listener_key: "listener-b",
          protocol: "trojan",
          port: 8443,
          address: "alpha.example.com",
          name: "Alpha",
        })
      );
    });
  });

  it("preserves an existing listener_key when editing and the listener is no longer available", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm
        initialValues={{
          name: "Alpha Node",
          server_id: 1,
          listener_key: "listener-missing",
          protocol: "vless",
          address: "alpha.example.com",
          port: 443,
          tags: [],
        }}
        onSubmit={onSubmit}
        title="Edit Node"
        trigger="Edit"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByDisplayValue("listener-missing (Unavailable)")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          listener_key: "listener-missing",
          protocol: "vless",
          port: 443,
        })
      );
    });
  });
});
