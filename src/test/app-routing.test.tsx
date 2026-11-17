import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

const lastMatchedId = (path: string) => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(path).at(-1)?.routeId;
};

describe("App routing", () => {
  it("renders the agency home page at / instead of falling back to not found", () => {
    expect(lastMatchedId("/")).toBe("/");
  });

  it("renders the dedicated billing workspace at /billing", () => {
    expect(lastMatchedId("/billing")).toBe("/billing");
  });

  it("renders settings, archive and reports pages", () => {
    expect(lastMatchedId("/settings")).toBe("/settings");
    expect(lastMatchedId("/orders")).toBe("/orders");
    expect(lastMatchedId("/reports")).toBe("/reports");
  });

  it("renders the projects workspace at /projects and /customers", () => {
    expect(lastMatchedId("/projects")).toBe("/projects");
    expect(lastMatchedId("/customers")).toBe("/customers");
  });

  it("renders the finance, suppliers and expenses pages", () => {
    expect(lastMatchedId("/finance")).toBe("/finance");
    expect(lastMatchedId("/suppliers")).toBe("/suppliers");
    expect(lastMatchedId("/expenses")).toBe("/expenses");
  });

  it("never falls back to the bare root route for valid pages", () => {
    expect(lastMatchedId("/billing")).not.toBe(rootRouteId);
    expect(lastMatchedId("/settings")).not.toBe(rootRouteId);
    expect(lastMatchedId("/projects")).not.toBe(rootRouteId);
  });

  it("removes legacy printing press and calculator routes", () => {
    expect(lastMatchedId("/calculator")).not.toBe("/calculator");
    expect(lastMatchedId("/materials")).not.toBe("/materials");
    expect(lastMatchedId("/production")).not.toBe("/production");
    expect(lastMatchedId("/proforma-invoices")).not.toBe("/proforma-invoices");
    expect(lastMatchedId("/invoices")).not.toBe("/invoices");
  });
});
