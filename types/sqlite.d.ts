declare module 'node:sqlite' {
  type Value = string | number | bigint | null | Uint8Array;
  export class DatabaseSync {
    constructor(path: string, options?: { timeout?: number; readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): { get(...values: Value[]): Record<string, Value> | undefined; all(...values: Value[]): Record<string, Value>[]; run(...values: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint } };
    close(): void;
  }
  export function backup(source: DatabaseSync, path: string): Promise<void>;
}
