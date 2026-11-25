import { protocols } from "./constants";
import { getProtocolDefaultConfig } from "./defaults";
import type { ListenerDraft, ProtocolType } from "./types";

type ProtocolValue = Record<string, any>;

function normalizeMultiplexValue(
  protocolType: ProtocolType,
  value: unknown,
  fallback: unknown
) {
  const raw = String(value || fallback || "").trim();
  if (protocolType !== "mieru") {
    return raw || "none";
  }

  switch (raw.toUpperCase()) {
    case "NONE":
    case "OFF":
    case "MULTIPLEXING_OFF":
      return "MULTIPLEXING_OFF";
    case "":
    case "LOW":
    case "MULTIPLEXING_LOW":
      return "MULTIPLEXING_LOW";
    case "MIDDLE":
    case "MEDIUM":
    case "MULTIPLEXING_MIDDLE":
      return "MULTIPLEXING_MIDDLE";
    case "HIGH":
    case "MULTIPLEXING_HIGH":
      return "MULTIPLEXING_HIGH";
    default:
      return raw;
  }
}

function normalizeNowhereNetwork(value: unknown) {
  const network = String(value || "mix")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "");
  if (
    [
      "mix",
      "mixed",
      "both",
      "tcp,udp",
      "udp,tcp",
      "tcp+udp",
      "udp+tcp",
    ].includes(network)
  )
    return "mix";
  return network === "quic" ? "udp" : network;
}

const editableTypes = new Set<string>(protocols);

function isEditableProtocol(protocol: ProtocolValue) {
  return editableTypes.has(
    protocol.type === "hysteria" ? "hysteria2" : String(protocol.type)
  );
}

// A listener's catalogue type. Stored `hysteria` listeners are edited through
// the `hysteria2` field set, which is how this panel has always presented them.
export function catalogueType(storedType?: string): ProtocolType {
  const type = storedType === "hysteria" ? "hysteria2" : storedType;
  return editableTypes.has(type as string)
    ? (type as ProtocolType)
    : protocols[0];
}

// Build one editable listener: from a stored protocol when editing, or from
// the type's defaults when the administrator adds one. An added listener is
// enabled, since adding a disabled listener has no purpose; a stored one keeps
// whatever state it was saved with.
export function buildListenerDraft(
  type: ProtocolType,
  storedProtocol?: ProtocolValue
): ListenerDraft {
  const defaultConfig = getProtocolDefaultConfig(type);
  const draft_id = crypto.randomUUID();

  if (!storedProtocol) {
    return { ...defaultConfig, draft_id, enable: true };
  }

  const merged = {
    ...defaultConfig,
    ...storedProtocol,
    draft_id,
    type,
    // A stored listener need not carry a transport — a protocol without stream
    // fields never sets one — so fall back to the type's default instead of
    // overwriting it with undefined.
    transport:
      storedProtocol.transport === "websocket"
        ? "ws"
        : (storedProtocol.transport ?? defaultConfig.transport),
    plugin: storedProtocol.plugin || "none",
    multiplex: normalizeMultiplexValue(
      type,
      storedProtocol.multiplex,
      defaultConfig.multiplex
    ),
  };
  if (type === "nowhere") {
    const version = Number(storedProtocol.version ?? 0);
    merged.version = version === 0 || version === 1 ? 3 : version;
    if (version === 0 || version === 1 || !storedProtocol.alpn?.length)
      merged.alpn = ["nw3"];
    merged.obfs =
      String(storedProtocol.obfs || "morph")
        .trim()
        .toLowerCase() || "morph";
    merged.network = normalizeNowhereNetwork(storedProtocol.network);
  }
  // Only TLS-only protocols are coerced. REALITY settings remain intact.
  if (["hysteria2", "tuic", "naive", "nowhere"].includes(type)) {
    merged.security = "tls";
    if (!merged.cert_mode || merged.cert_mode === "none") {
      merged.cert_mode = "self";
    }
  }
  if (
    ["anytls", "trojan"].includes(type) &&
    !["tls", "reality"].includes(String(merged.security))
  ) {
    merged.security = "tls";
    merged.cert_mode = "self";
  }
  if (merged.security === "reality") {
    // Never overwrite a stored transport: REALITY rides any stream transport
    // on vless, and rewriting it here made every edit — even a rename —
    // silently destroy an xhttp node's configuration.
    if (!merged.transport) {
      merged.transport = "tcp";
    }
    merged.cert_mode = "none";
  }
  return merged;
}

// Every stored listener gets its own row, in stored order. Collapsing them to
// one row per protocol type would discard a server's second listener of a type
// before it could be rendered, and dropping it from the form would delete it on
// the next save.
export function getListenerFormValues(
  initialProtocols: readonly ProtocolValue[] = []
) {
  return initialProtocols
    .filter(isEditableProtocol)
    .map((protocol) =>
      buildListenerDraft(catalogueType(protocol.type), protocol)
    );
}

// An older panel may not expose every protocol the backend already supports.
// Keep those stored entries out of the editable schema and retain them on save.
export function getUneditableProtocols(
  existing: readonly ProtocolValue[] = []
) {
  return existing.filter((protocol) => !isEditableProtocol(protocol));
}

export function preserveUneditableProtocols(
  edited: ProtocolValue[],
  existing: readonly ProtocolValue[] = []
) {
  return [...edited, ...getUneditableProtocols(existing)];
}
