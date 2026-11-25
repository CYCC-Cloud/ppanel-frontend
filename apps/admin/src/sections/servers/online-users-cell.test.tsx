// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnlineUsersCell from "./online-users-cell";

type AddressColumn = {
  accessorKey?: string;
  cell?: (context: {
    row: { original: API.ServerOnlineUser };
  }) => React.ReactNode;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@workspace/ui/services/admin/admin", () => ({
  getUserSubscribeDetail: vi.fn(),
}));

vi.mock("@/sections/user/user-detail", () => ({
  UserDetail: () => <div>user detail</div>,
}));

vi.mock("@workspace/ui/composed/pro-table/pro-table", () => ({
  ProTable: ({
    columns,
    request,
  }: {
    columns: AddressColumn[];
    request: () => Promise<{ list: API.ServerOnlineUser[] }>;
  }) => {
    const [rows, setRows] = useState<API.ServerOnlineUser[]>([]);

    useEffect(() => {
      request().then((result) => setRows(result.list));
    }, [request]);

    const addressColumn = columns.find((column) => column.accessorKey === "ip");

    return (
      <div>
        {rows.map((row) => (
          <div key={row.subscribe_id}>
            {addressColumn?.cell?.({ row: { original: row } })}
          </div>
        ))}
      </div>
    );
  },
}));

const online = (addresses: API.ServerOnlineIP[]) =>
  ({
    online: [
      {
        ip: addresses,
        subscribe_id: 42,
        user_id: 7,
        subscribe: "Premium",
        traffic: 0,
        expired_at: 0,
      },
    ],
  }) as unknown as API.ServerStatus;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("online addresses", () => {
  it("identifies each listener an address is online on", async () => {
    render(
      <OnlineUsersCell
        status={online([
          {
            ip: "198.51.100.5",
            protocol: "trojan",
            listener_key: "listener-a",
            listener_name: "Primary",
          },
          {
            ip: "198.51.100.5",
            protocol: "trojan",
            listener_key: "listener-b",
            listener_name: "Fallback",
          },
        ])}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText("Primary")).toBeTruthy());
    expect(screen.getByText("Fallback")).toBeTruthy();
    expect(screen.getAllByText("198.51.100.5")).toHaveLength(2);
  });

  it("falls back to the protocol when a listener has no label", async () => {
    render(
      <OnlineUsersCell
        status={online([
          {
            ip: "203.0.113.9",
            protocol: "vmess",
            listener_key: "listener-c",
            listener_name: "",
          },
        ])}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText("vmess")).toBeTruthy());
  });
});
