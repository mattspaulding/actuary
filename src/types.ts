/** A payment option advertised in a service's x402 `accepts` array. */
export interface PaymentOption {
  scheme: string;
  /** CAIP-2 network id, e.g. "eip155:8453" for Base. */
  network: string;
  /** Token contract address. */
  asset: string;
  /** Price in atomic units (USDC has 6 decimals). */
  amount: string;
  payTo: string;
  extra?: Record<string, unknown>;
}

/** One service listing from the Circle x402 Discovery API. */
export interface ServiceListing {
  /** The paid endpoint URL — the unique key Actuary scores by. */
  resource: string;
  type: string;
  accepts: PaymentOption[];
  provider: {
    name?: string;
    category?: string;
    description?: string;
    website?: string;
  };
  method: string;
  /** Cheapest advertised USDC price across accepts, in whole USDC. */
  minPriceUsdc: number | null;
  supportsCircleGateway: boolean;
  supportsVanillax402: boolean;
  lastUpdated?: string;
}

export type ProbeMode = 'estimate' | 'paid';

export type ProbeOutcome =
  /** Endpoint answered with a well-formed x402 402 challenge. */
  | 'up_402'
  /** Endpoint answered 2xx without demanding payment. */
  | 'up_free'
  /** Paid probe: payment made and a 2xx response received. */
  | 'up_paid'
  /** Endpoint reachable but the response was malformed (bad 402, bad JSON). */
  | 'malformed'
  /** HTTP 4xx/5xx other than 402. */
  | 'http_error'
  /** Network failure or timeout. */
  | 'unreachable'
  /**
   * OUR side failed (expired auth session, insufficient balance, price cap,
   * chain mismatch). Says nothing about the service — excluded from scoring.
   */
  | 'probe_error';

/** One probe observation, appended to data/probes.jsonl. */
export interface ProbeResult {
  ts: string;
  resource: string;
  provider: string;
  category: string;
  mode: ProbeMode;
  outcome: ProbeOutcome;
  latencyMs: number;
  httpStatus?: number;
  /** USDC actually spent (paid mode only), parsed from the CLI's payment record. */
  paidUsdc?: number;
  /** Settlement reference from the payment receipt (paid mode only). */
  txRef?: string;
  /** Whether a paid response parsed as valid JSON matching the advertised shape. */
  schemaValid?: boolean;
  /** Gemini quality grade 0-10 (paid mode only, when grading ran). */
  quality?: number | null;
  qualityRationale?: string;
  error?: string;
}

/** Aggregated score for one service over the scoring window. */
export interface ServiceScore {
  resource: string;
  provider: string;
  category: string;
  samples: number;
  paidSamples: number;
  /** Fraction of probes that found the service up (0-1). */
  uptime: number;
  latencyP50Ms: number | null;
  schemaValidRate: number | null;
  avgQuality: number | null;
  /** Composite 0-100. */
  composite: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  firstProbe: string;
  lastProbe: string;
}
