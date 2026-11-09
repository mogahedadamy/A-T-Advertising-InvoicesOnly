import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
const lastMatchedId = (path: string) => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path).at(-1)?.routeId;
};

describe("App routing", () => {
  it("renders the dashboard at / instead of falling back to not found", () => {
    expect(lastMatchedId("/")).toBe("/");
  });

  it("renders the calculator at /calculator", () => {
    expect(lastMatchedId("/calculator")).toBe("/calculator");
  });

  it("renders settings at /settings", () => {
    expect(lastMatchedId("/settings")).toBe("/settings");
  });

  it("never falls back to the bare root route", () => {
    expect(lastMatchedId("/calculator")).not.toBe(rootRouteId);
    expect(lastMatchedId("/settings")).not.toBe(rootRouteId);
  });
});
