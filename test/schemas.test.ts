import { expect, test } from "bun:test";
import { latestSchema } from "../src/index";

test("rejects blank restaurant names", () => {
  expect(latestSchema.safeParse({ restaurant_name: "" }).success).toBe(false);
  expect(latestSchema.safeParse({ restaurant_name: "   " }).success).toBe(false);
  expect(latestSchema.parse({ restaurant_name: "  Addison  " }).restaurant_name).toBe("Addison");
});
