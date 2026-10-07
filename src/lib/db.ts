import { MongoClient, type Collection, type Db } from "mongodb";
import type { FixtureDoc } from "./types";

declare global {
  var _mongoClient: Promise<MongoClient> | undefined;
}

// One client per server instance. In dev, hot reloads would otherwise open a
// new pool on every edit, so the promise is parked on globalThis.
function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example)");

  globalThis._mongoClient ??= new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5_000,
  }).connect();
  return globalThis._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB ?? "matchday");
}

export async function fixturesCollection(): Promise<Collection<FixtureDoc>> {
  return (await getDb()).collection<FixtureDoc>("fixtures");
}
