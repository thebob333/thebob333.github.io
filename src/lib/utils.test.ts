import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps the text color when a custom text size is added", () => {
    expect(cn("text-primary-foreground", "text-body")).toBe("text-primary-foreground text-body");
    expect(cn("text-white", "text-headline")).toBe("text-white text-headline");
  });

  it("still lets a later text size replace an earlier one", () => {
    expect(cn("text-sm", "text-body")).toBe("text-body");
    expect(cn("text-footnote", "text-title")).toBe("text-title");
  });
});
