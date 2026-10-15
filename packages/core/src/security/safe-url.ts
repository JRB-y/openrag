import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export class UnsafeUrlError extends Error {}

// SSRF guard: only http(s) URLs whose DNS resolution points exclusively
// at public ("unicast") addresses are allowed. Everything else - private,
// loopback, link-local, unique-local, multicast, reserved ranges, and
// IP literals pointing at them - is rejected. Resolving ourselves (instead
// of trusting the hostname) stops DNS-rebinding tricks too.
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const addresses = await dns.lookup(url.hostname, { all: true });

  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Could not resolve host: ${url.hostname}`);
  }

  for (const { address } of addresses) {
    if (ipaddr.parse(address).range() !== "unicast") {
      throw new UnsafeUrlError(`Blocked non-public address: ${address}`);
    }
  }

  return url;
}
