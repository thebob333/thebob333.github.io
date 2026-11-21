// Pin a non-UTC timezone: in UTC every local-vs-UTC date bug silently disappears.
process.env.TZ = "America/Los_Angeles";

import "@testing-library/jest-dom";
import { afterEach, beforeEach } from "vitest";
import { __resetStoresForTests } from "@/lib/store";
import { createMemoryBackend, setSnapshotBackend } from "@/lib/snapshots";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

beforeEach(() => {
  localStorage.clear();
  __resetStoresForTests();
  setSnapshotBackend(createMemoryBackend());
});

afterEach(() => {
  process.env.TZ = "America/Los_Angeles";
});
