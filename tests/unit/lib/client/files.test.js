import { getFormattedTimestamp } from "@/lib/client/files.js";

describe("lib/client/files.js", () => {
  describe("getFormattedTimestamp()", () => {
    test("Formata como AAAAMMDDHHmmSS", () => {
      expect(getFormattedTimestamp(new Date(2026, 6, 30, 14, 5, 9))).toBe(
        "20260730140509",
      );
    });
  });
});
