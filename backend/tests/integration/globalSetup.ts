import mongoose from "mongoose";

export const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"] ?? "mongodb://127.0.0.1:27017/hotel_platform_test";

/** Fails fast, with a readable message, if there is no database, and refuses to touch a non-test database. */
export default async function setup(): Promise<void> {
  const name = new URL(TEST_DATABASE_URL.replace(/^mongodb(\+srv)?:/, "http:")).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) throw new Error(`Refusing to run integration tests: database name "${name}" must end with "_test" (they delete data).`);
  try {
    await mongoose.connect(TEST_DATABASE_URL, { serverSelectionTimeoutMS: 4000 });
    await mongoose.disconnect();
  } catch {
    throw new Error("Integration tests need MongoDB. Start one and set TEST_DATABASE_URL (default mongodb://127.0.0.1:27017/hotel_platform_test).");
  }
}
