import { trusted } from "mongoose";

/**
 * Mongoose runs with sanitizeFilter=true, which turns any `$operator` found in a filter into a literal
 * value. That protects against injected operators, but it means OUR OWN operators must be marked trusted.
 * Only use these helpers with server-built values, never with request data.
 */
export const gt = (v: Date | number) => trusted({ $gt: v });
export const lt = (v: Date | number) => trusted({ $lt: v });
export const inList = <T>(values: readonly T[]) => trusted({ $in: [...values] });
export const ne = <T>(v: T) => trusted({ $ne: v });
export const containsText = (text: string) => trusted({ $regex: text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
