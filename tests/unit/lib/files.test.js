import { getFormattedTimestamp } from "@/lib/files.js";

describe("lib/files.js", () => {
  describe("getFormattedTimestamp()", () => {
    test("Formata como AAAAMMDDHHmmSS", () => {
      expect(getFormattedTimestamp(new Date(2026, 6, 30, 14, 5, 9))).toBe(
        "20260730140509",
      );
    });
  });
});
