import { expect, test, vi } from "vitest";
import { printHello } from "./";

test("printHello", () => {
  vi.spyOn(console, "log").mockImplementationOnce((msg) => msg);
  expect(printHello("world")).toBe("Hello world");
});
