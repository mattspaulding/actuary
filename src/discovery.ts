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
  pageSize?: number;
}

function minPriceUsdc(accepts: PaymentOption[]): number | null {
  const amounts = accepts
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
  const url = new URL(DISCOVERY_URL);
  url.searchParams.set('pageSize', String(opts.pageSize ?? 100));
  if (opts.query) url.searchParams.set('query', opts.query);
  if (opts.category) url.searchParams.set('category', opts.category);

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Discovery API returned HTTP ${res.status}`);
  }
  const body = (await res.json()) as { items?: DiscoveryItem[] };
  let services = (body.items ?? [])
    .filter((i) => i.type === 'http' && typeof i.resource === 'string')
    .map(normalize);

  if (opts.maxPriceUsdc !== undefined) {
    services = services.filter(
      (s) => s.minPriceUsdc !== null && s.minPriceUsdc <= opts.maxPriceUsdc!,
    );
  }
  return services;
}
