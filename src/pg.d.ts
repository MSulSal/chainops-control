declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export type QueryResult<R extends QueryResultRow = QueryResultRow> = {
    rows: R[];
    rowCount: number | null;
  };

  export interface PoolClient {
    query<R extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: readonly unknown[]
    ): Promise<QueryResult<R>>;
    release(): void;
  }

  export type PoolConfig = {
    connectionString?: string;
  };

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
