import { XHTTP_MODES } from "./constants";
import type { ProtocolType } from "./types";

export function getProtocolDefaultConfig(proto: ProtocolType) {
  switch (proto) {
    case "shadowsocks":
      return {
        listener_name: null,
        type: "shadowsocks",
        enable: false,
        port: null,
        cipher: "chacha20-ietf-poly1305",
        server_key: null,
        obfs: "none",
        obfs_host: null,
        obfs_path: null,
        sni: null,
        allow_insecure: null,
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "vmess":
      return {
        listener_name: null,
        type: "vmess",
        enable: false,
        host: null,
        port: null,
        transport: "tcp",
        security: "none",
        path: null,
        service_name: null,
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "vless":
      return {
        listener_name: null,
        type: "vless",
        enable: false,
        host: null,
        port: null,
        transport: "tcp",
        security: "none",
        flow: "none",
        path: null,
        service_name: null,
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        reality_server_addr: null,
        reality_server_port: null,
        reality_private_key: null,
        reality_public_key: null,
        reality_short_id: null,
        xhttp_mode: XHTTP_MODES[0], // 'auto'
        xhttp_extra: null,
        encryption: "none",
        encryption_mode: null,
        encryption_rtt: null,
        encryption_ticket: null,
        encryption_server_padding: null,
        encryption_private_key: null,
        encryption_client_padding: null,
        encryption_password: null,
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "trojan":
      return {
        listener_name: null,
        type: "trojan",
        enable: false,
        host: null,
        port: null,
        transport: "tcp",
        security: "tls",
        path: null,
        service_name: null,
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "hysteria":
      return {
        listener_name: null,
        type: "hysteria",
        enable: false,
        port: null,
        hop_ports: null,
        hop_interval: null,
        obfs: "none",
        obfs_password: null,
        security: "tls",
        up_mbps: null,
        down_mbps: null,
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "tuic":
      return {
        listener_name: null,
        type: "tuic",
        enable: false,
        port: null,
        disable_sni: false,
        reduce_rtt: false,
        udp_relay_mode: "native",
        congestion_controller: "bbr",
        security: "tls",
        sni: null,
        allow_insecure: false,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "socks":
      return {
        listener_name: null,
        type: "socks",
        enable: false,
        port: null,
        ratio: 1,
      } as any;
    case "naive":
      return {
        listener_name: null,
        type: "naive",
        enable: false,
        port: null,
        security: "none",
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "http":
      return {
        listener_name: null,
        type: "http",
        enable: false,
        port: null,
        security: "none",
        sni: null,
        allow_insecure: null,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    case "mieru":
      return {
        listener_name: null,
        type: "mieru",
        enable: false,
        port: null,
        multiplex: "none",
        transport: "tcp",
      } as any;
    case "anytls":
      return {
        listener_name: null,
        type: "anytls",
        enable: false,
        port: null,
        security: "tls",
        padding_scheme: null,
        sni: null,
        allow_insecure: false,
        fingerprint: "chrome",
        cert_mode: "none",
        cert_dns_provider: null,
        cert_dns_env: null,
        ratio: 1,
      } as any;
    default:
      return {} as any;
  }
}
