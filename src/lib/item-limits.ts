import { z } from "zod";

/** A limit typed in a form: blank means "no limit", otherwise a whole number of 1 or more. */
export const optionalLimit = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int("Limits must be whole numbers").min(1, "A limit must be 1 or more").max(100000).nullable()
);