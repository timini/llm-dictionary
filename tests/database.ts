import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { Env } from "../lib/server";
export function testEnvironment() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_cache.sql", import.meta.url),
      "utf8",
    ),
  );
  class Statement {
    private values: (string | number | null)[] = [];
    constructor(private sql: string) {}
    bind(...values: unknown[]) {
      this.values = values as (string | number | null)[];
      return this;
    }
    async first<T>() {
      return (
        (sqlite.prepare(this.sql).get(...this.values) as T | undefined) ?? null
      );
    }
    async all<T>() {
      return { results: sqlite.prepare(this.sql).all(...this.values) as T[] };
    }
    async run() {
      return {
        meta: {
          changes: Number(sqlite.prepare(this.sql).run(...this.values).changes),
        },
      };
    }
  }
  const env: Env = {
    GEMINI_API_KEY: "test",
    GENERATION_MODEL: "gen",
    EMBEDDING_MODEL: "embed",
    DB: {
      prepare: (sql) => new Statement(sql),
      batch: async (statements) => {
        sqlite.exec("BEGIN");
        try {
          const results = await Promise.all(
            statements.map((statement) => statement.run()),
          );
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
  return { env, sqlite };
}
