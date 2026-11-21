import { jest } from "@jest/globals";

import database from "@/infra/database.js";
import audit from "@/models/audit.js";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("models/audit.js", () => {
  describe(".findBanEvents()", () => {
    test("Retorna os eventos de banimento e desbanimento em ordem cronológica", async () => {
      const events = [
        { id: "event-2", action: "unban" },
        { id: "event-1", action: "ban" },
      ];
      const querySpy = jest
        .spyOn(database, "query")
        .mockResolvedValue({ rows: events, rowCount: events.length });

      const result = await audit.findBanEvents();

      expect(result).toEqual(events);
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("LEFT JOIN"),
        }),
      );
      const [query] = querySpy.mock.calls[0];
      expect(query.text).toContain("ORDER BY");
      expect(query.text).toContain("events.created_at DESC");
      expect(query.text).toContain("events.id DESC");
    });

    test("Retorna uma lista vazia quando não há eventos", async () => {
      jest
        .spyOn(database, "query")
        .mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(audit.findBanEvents()).resolves.toEqual([]);
    });
  });
});
