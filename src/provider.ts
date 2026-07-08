import { setTimeout as delay } from "node:timers/promises";
import {
  buildTransactionSample,
  normalizeWalletAddress,
  type SourceMetadata,
  type TransactionSample
} from "./domain.ts";

export type TransactionProviderResult = {
  transactions: TransactionSample[];
  sourceMetadata: SourceMetadata;
};

export type TransactionProvider = {
  fetchTransactionSample(input: {
    walletAddress: string;
    traceId: string;
  }): Promise<TransactionProviderResult>;
};

type EtherscanTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  confirmations: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ProviderErrorCode = "timeout" | "http_error" | "invalid_response";

export class ProviderFetchError extends Error {
  readonly code: ProviderErrorCode;
  readonly retriable: boolean;
  readonly timeoutMs: number;
  readonly provider: string;

  constructor(
    message: string,
    options: {
      code: ProviderErrorCode;
      retriable?: boolean;
      timeoutMs?: number;
      provider?: string;
    }
  ) {
    super(message);
    this.name = "ProviderFetchError";
    this.code = options.code;
    this.retriable = options.retriable ?? true;
    this.timeoutMs = options.timeoutMs ?? 0;
    this.provider = options.provider ?? "etherscan-account-txlist";
  }
}

export class FixtureTransactionProvider implements TransactionProvider {
  readonly timeoutMs: number;

  constructor(timeoutMs = 1500) {
    this.timeoutMs = timeoutMs;
  }

  async fetchTransactionSample(input: {
    walletAddress: string;
    traceId: string;
  }): Promise<TransactionProviderResult> {
    if (shouldForceFixtureTimeout(input.traceId)) {
      throw new ProviderFetchError(
        `fixture provider forced a timeout for replay evidence trace ${input.traceId}`,
        {
          code: "timeout",
          timeoutMs: this.timeoutMs
        }
      );
    }

    const walletAddress = normalizeWalletAddress(input.walletAddress);
    const transactions = buildTransactionSample(walletAddress);

    return {
      transactions,
      sourceMetadata: {
        provider: "deterministic-fixture",
        mode: "fixture",
        network: "ethereum-mainnet",
        fetchedAt: new Date().toISOString(),
        attemptCount: 1,
        timeoutMs: this.timeoutMs,
        transactionCount: transactions.length
      }
    };
  }
}

function shouldForceFixtureTimeout(traceId: string): boolean {
  return /^trace-demo-replay-failed(?:-|$)/.test(traceId);
}

export class EtherscanTransactionProvider implements TransactionProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly sampleSize: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly fetcher: FetchLike;

  constructor(options: {
    baseUrl: string;
    apiKey?: string;
    sampleSize?: number;
    timeoutMs?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    fetcher?: FetchLike;
  }) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey ?? "demo";
    this.sampleSize = options.sampleSize ?? 5;
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 100;
    this.fetcher = options.fetcher ?? fetch;
  }

  async fetchTransactionSample(input: {
    walletAddress: string;
    traceId: string;
  }): Promise<TransactionProviderResult> {
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const transactions = await this.fetchAttempt(walletAddress, input.traceId);

        return {
          transactions,
          sourceMetadata: {
            provider: "etherscan-account-txlist",
            mode: "live",
            network: "ethereum-mainnet",
            fetchedAt: new Date().toISOString(),
            attemptCount: attempt,
            timeoutMs: this.timeoutMs,
            transactionCount: transactions.length
          }
        };
      } catch (error) {
        lastError = error as Error;
        const providerError = normalizeProviderError(lastError);

        if (!providerError.retriable || attempt === this.maxAttempts) {
          throw providerError;
        }

        await delay(this.retryDelayMs);
      }
    }

    throw normalizeProviderError(lastError);
  }

  private async fetchAttempt(walletAddress: string, traceId: string): Promise<TransactionSample[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", walletAddress);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", String(this.sampleSize));
    url.searchParams.set("sort", "desc");
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "99999999");
    url.searchParams.set("apikey", this.apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        headers: { "x-request-id": traceId },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new ProviderFetchError(`provider returned HTTP ${response.status}`, {
          code: "http_error",
          timeoutMs: this.timeoutMs
        });
      }

      const payload = (await response.json()) as {
        status?: string;
        message?: string;
        result?: EtherscanTransaction[] | string;
      };

      if (payload.status === "0" && payload.result === "No transactions found") {
        return [];
      }

      if (!Array.isArray(payload.result)) {
        throw new ProviderFetchError(
          `provider returned an unexpected payload: ${payload.message ?? "missing result array"}`,
          {
            code: "invalid_response",
            retriable: false,
            timeoutMs: this.timeoutMs
          }
        );
      }

      return payload.result.map((tx) => mapEtherscanTransaction(walletAddress, tx));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new ProviderFetchError(`provider request timed out after ${this.timeoutMs}ms`, {
          code: "timeout",
          timeoutMs: this.timeoutMs
        });
      }

      throw normalizeProviderError(error as Error, this.timeoutMs);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createDefaultTransactionProviderFromEnv(): TransactionProvider {
  const baseUrl = process.env.CHAINOPS_ETHERSCAN_BASE_URL?.trim();
  if (baseUrl) {
    return new EtherscanTransactionProvider({
      baseUrl,
      apiKey: process.env.CHAINOPS_ETHERSCAN_API_KEY?.trim(),
      sampleSize: Number(process.env.CHAINOPS_ETHERSCAN_SAMPLE_SIZE ?? 5),
      timeoutMs: Number(process.env.CHAINOPS_PROVIDER_TIMEOUT_MS ?? 1500),
      maxAttempts: Number(process.env.CHAINOPS_PROVIDER_MAX_ATTEMPTS ?? 2),
      retryDelayMs: Number(process.env.CHAINOPS_PROVIDER_RETRY_DELAY_MS ?? 100)
    });
  }

  return new FixtureTransactionProvider(Number(process.env.CHAINOPS_PROVIDER_TIMEOUT_MS ?? 1500));
}

function mapEtherscanTransaction(
  walletAddress: string,
  transaction: EtherscanTransaction
): TransactionSample {
  const from = transaction.from.toLowerCase();
  const to = transaction.to.toLowerCase();
  const direction = from === walletAddress ? "outbound" : "inbound";
  const counterparty = direction === "outbound" ? to : from;

  return {
    hash: transaction.hash.toLowerCase(),
    direction,
    amountEth: Number.parseFloat(formatWeiToEth(transaction.value).toFixed(4)),
    confirmations: Number(transaction.confirmations),
    counterparty
  };
}

function formatWeiToEth(value: string): number {
  const wei = BigInt(value);
  const divisor = 10n ** 18n;
  const whole = wei / divisor;
  const fractional = wei % divisor;
  const paddedFraction = fractional.toString().padStart(18, "0").slice(0, 4);
  return Number(`${whole}.${paddedFraction}`);
}

function normalizeProviderError(error: Error | undefined, timeoutMs = 0): ProviderFetchError {
  if (!error) {
    return new ProviderFetchError("provider request failed", {
      code: "http_error",
      timeoutMs
    });
  }

  if (error instanceof ProviderFetchError) {
    return error;
  }

  return new ProviderFetchError(error.message, {
    code: "http_error",
    timeoutMs
  });
}
