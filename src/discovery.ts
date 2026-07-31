import type { PaymentOption, ServiceListing } from './types.ts';

const DISCOVERY_URL = 'https://api.circle.com/v2/x402/discovery/resources';

/** USDC has 6 decimals; discovery `amount` fields are atomic units. */
const USDC_DECIMALS = 1_000_000;

interface DiscoveryItem {
  resource: string;
  type: string;
  lastUpdated?: string;
  accepts?: PaymentOption[];
  metadata?: {
    provider?: ServiceListing['provider'];
    method?: string;
    supportsCircleGateway?: boolean;
    supportsVanillax402?: boolean;
    [k: string]: unknown;
  };
}

export interface DiscoveryOptions {
  query?: string;
  category?: string;
  /** Only services whose cheapest option is at or under this, in USDC. */
  maxPriceUsdc?: number;
  /** Max listings to fetch across pages. */
  maxItems?: number;
}

function minPriceUsdc(accepts: PaymentOption[]): number | null {
  const amounts = accepts
    .map((a) => Number(a.amount))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (amounts.length === 0) return null;
  return Math.min(...amounts) / USDC_DECIMALS;
}

/**
 * Advertised price for a specific CAIP-2 network, in USDC — the number the
 * probe will actually be charged on that chain. Cross-network minimums lie:
 * a service can ask $0.001 on Base and $0.01 on Arc.
 */
export function priceOnChainUsdc(
  accepts: PaymentOption[],
  caip2: string,
): number | null {
  const amounts = accepts
    .filter((a) => a.network === caip2)
    .map((a) => Number(a.amount))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (amounts.length === 0) return null;
  return Math.min(...amounts) / USDC_DECIMALS;
}

function normalize(item: DiscoveryItem): ServiceListing {
  const accepts = item.accepts ?? [];
  return {
    resource: item.resource,
    type: item.type,
    accepts,
    provider: item.metadata?.provider ?? {},
    method: (item.metadata?.method ?? 'GET').toUpperCase(),
    minPriceUsdc: minPriceUsdc(accepts),
    supportsCircleGateway: Boolean(item.metadata?.supportsCircleGateway),
    supportsVanillax402: Boolean(item.metadata?.supportsVanillax402),
    lastUpdated: item.lastUpdated,
  };
}

/**
 * Enumerate services from Circle's public x402 Discovery API.
 * No auth, no API key — this is the whole point of "payment as authentication".
 */
export async function discoverServices(
  opts: DiscoveryOptions = {},
): Promise<ServiceListing[]> {
  const maxItems = opts.maxItems ?? 500;
  const pageLimit = 100;
  const items: DiscoveryItem[] = [];

  // The Discovery API paginates with limit/offset (the same params Circle's
  // own CLI sends); an unknown param would be silently ignored.
  for (let offset = 0; offset < maxItems; offset += pageLimit) {
    const url = new URL(DISCOVERY_URL);
    url.searchParams.set('limit', String(pageLimit));
    url.searchParams.set('offset', String(offset));
    if (opts.query) url.searchParams.set('query', opts.query);
    if (opts.category) url.searchParams.set('category', opts.category);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Discovery API returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as { items?: DiscoveryItem[] };
    const page = body.items ?? [];
    items.push(...page);
    if (page.length < pageLimit) break;
  }

  let services = items
    .filter((i) => i.type === 'http' && typeof i.resource === 'string')
    .map(normalize);

  if (opts.maxPriceUsdc !== undefined) {
    services = services.filter(
      (s) => s.minPriceUsdc !== null && s.minPriceUsdc <= opts.maxPriceUsdc!,
    );
  }
  return services;
}
