import dns from "node:dns";
import net from "node:net";

dns.setDefaultResultOrder("ipv4first");
// Node 22 tries IPv6 first and waits out the connect timeout when that route is dead.
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

export function postgresOptions(url: string, max: number) {
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  return {
    max,
    ssl: local ? false : ("require" as const),
    connect_timeout: 30,
  };
}
