import { getServerList as filterServerList } from "@workspace/ui/services/admin/admin";
import { create } from "zustand";
import { fetchAllPaginated } from "./pagination";

/** One selectable listener of a server, identified by its stable key. */
export interface ServerListenerOption {
  listener_key: string;
  /** The listener's label, falling back to its protocol type. */
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
      const servers = await fetchAllPaginated(filterServerList);
      set({
        servers,
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

  // A server may run several listeners of one protocol type, so a listener is
  // only selectable through its key. A listener without one has not been
  // persisted yet and cannot be bound to.
  getAvailableListeners: (serverId?: number) => {
    if (!serverId) return [];
    return get()
      .getServerEnabledProtocols(serverId)
      .filter((p) => Boolean(p.listener_key))
      .map((p) => ({
        listener_key: p.listener_key,
        listener_name: p.listener_name || p.type,
        protocol: p.type,
        port: p.port,
      }));
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
