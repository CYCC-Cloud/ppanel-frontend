import { filterServerList } from "@workspace/ui/services/admin/server";
import { create } from "zustand";

export interface ServerListenerOption {
  listener_key: string;
  listener_name: string;
  protocol: string;
  port: number;
}

interface ServerState {
  // Data
  servers: API.Server[];

  // Loading states
  loading: boolean;
  loaded: boolean;

  // Actions
  fetchServers: () => Promise<void>;

  // Getters
  getServerById: (serverId: number) => API.Server | undefined;
  getServerName: (serverId?: number) => string;
  getServerAddress: (serverId?: number) => string;
  getServerEnabledProtocols: (serverId: number) => API.Protocol[];
  getAvailableListeners: (serverId?: number) => ServerListenerOption[];
  getListenerByKey: (
    serverId?: number,
    listenerKey?: string
  ) => ServerListenerOption | undefined;
}

export const useServerStore = create<ServerState>((set, get) => ({
  // Initial state
  servers: [],
  loading: false,
  loaded: false,

  // Actions
  fetchServers: async () => {
    if (get().loading) return;

    set({ loading: true });
    try {
      const { data } = await filterServerList({ page: 1, size: 999_999_999 });
      set({
        servers: data?.data?.list || [],
        loaded: true,
      });
    } catch (_error) {
      // Handle error silently
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  // Getters
  getServerById: (serverId: number) =>
    get().servers.find((s) => s.id === serverId),

  getServerName: (serverId?: number) => {
    if (!serverId) return "—";
    const server = get().servers.find((s) => s.id === serverId);
    return server?.name ?? `#${serverId}`;
  },

  getServerAddress: (serverId?: number) => {
    if (!serverId) return "—";
    const server = get().servers.find((s) => s.id === serverId);
    return server?.address ?? "—";
  },

  getServerEnabledProtocols: (serverId: number) => {
    const server = get().servers.find((s) => s.id === serverId);
    return server?.protocols?.filter((p) => p.enable) || [];
  },

  getAvailableListeners: (serverId?: number) => {
    if (!serverId) return [];

    return get()
      .getServerEnabledProtocols(serverId)
      .flatMap((protocol) => {
        const listenerKey = (
          protocol as API.Protocol & { listener_key?: string }
        ).listener_key;

        if (!listenerKey) return [];

        return [
          {
            listener_key: listenerKey,
            listener_name:
              (protocol as API.Protocol & { listener_name?: string | null })
                .listener_name || protocol.type,
            protocol: protocol.type,
            port: protocol.port,
          },
        ];
      });
  },

  getListenerByKey: (serverId?: number, listenerKey?: string) => {
    if (!(serverId && listenerKey)) return;

    return get()
      .getAvailableListeners(serverId)
      .find((listener) => listener.listener_key === listenerKey);
  },
}));

export const useServer = () => {
  const store = useServerStore();

  // Auto-fetch servers
  if (!(store.loaded || store.loading)) {
    store.fetchServers();
  }

  return {
    servers: store.servers,
    loading: store.loading,
    loaded: store.loaded,
    fetchServers: store.fetchServers,
    getServerById: store.getServerById,
    getServerName: store.getServerName,
    getServerAddress: store.getServerAddress,
    getServerEnabledProtocols: store.getServerEnabledProtocols,
    getAvailableListeners: store.getAvailableListeners,
    getListenerByKey: store.getListenerByKey,
  };
};

export default useServerStore;
