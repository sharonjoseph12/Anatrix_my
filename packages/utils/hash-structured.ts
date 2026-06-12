import { sha256Hex } from "./sha256";
import { stableStringify } from "./stable-stringify";

export function hashStructured(value: unknown): string {
  return sha256Hex(stableStringify(value));
}
