import { beforeEach, describe, expect, it } from "vitest";
import {
  findCustomerByNormalizedName,
  findCustomerMatch,
  normalizeCustomerName,
  normalizePhoneDigits,
} from "./customerMatching";
import {
  addCustomer,
  archiveCustomer,
  findOrCreateCustomerByName,
  getCustomersSnapshot,
  type CustomerRecord,
} from "@/lib/customersStore";

const makeCustomer = (overrides: Partial<CustomerRecord>): CustomerRecord => ({
  id: "cust-1",
  name: "شركة النيل الحديثة",
  phone: "0912345678",
  type: "company",
  address: "",
  totalOrders: 0,
  totalSpent: 0,
  balance: 0,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("normalizeCustomerName & normalizePhoneDigits", () => {
  it("normalizes Arabic alef, ta marbuta, ya/alef maksura, diacritics and extra spaces", () => {
    expect(normalizeCustomerName("أحمد   المُصْطَفَى")).toBe("احمد المصطفي");
    expect(normalizeCustomerName("شركة   الروضة   للدعاية")).toBe(
      normalizeCustomerName("شركه الروضه للدعايه")
    );
    expect(normalizeCustomerName("إبراهيمـ")).toBe("ابراهيم");
  });

  it("normalizes Arabic-Indic digits into ASCII digits", () => {
    expect(normalizePhoneDigits("٠٩١٢-٣٤٥-٦٧٨")).toBe("0912345678");
  });
});

describe("findCustomerMatch", () => {
  const sample: CustomerRecord[] = [
    makeCustomer({ id: "c1", name: "شركة النيل", phone: "0911111111" }),
    makeCustomer({ id: "c2", name: "مؤسسة الأفق", phone: "0922222222", isArchived: true }),
    makeCustomer({ id: "c3", name: "وكالة النيل للإعلان", phone: "0933333333" }),
  ];

  it("finds exact active match regardless of Arabic spelling variants", () => {
    const res = findCustomerMatch(sample, "شركه النيل");
    expect(res.exactActive?.id).toBe("c1");
    expect(res.exactArchived).toBeNull();
  });

  it("identifies exact archived match while excluding archived records from suggestions", () => {
    const res = findCustomerMatch(sample, "مؤسسه الافق");
    expect(res.exactActive).toBeNull();
    expect(res.exactArchived?.id).toBe("c2");
    expect(res.suggestions.some((c) => c.id === "c2")).toBe(false);
  });

  it("matches by normalized phone digits and puts prefix matches first", () => {
    const phoneMatch = findCustomerMatch(sample, "093333");
    expect(phoneMatch.suggestions.map((c) => c.id)).toEqual(["c3"]);

    const prefixMatch = findCustomerMatch(sample, "النيل");
    expect(prefixMatch.suggestions.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("exposes findCustomerByNormalizedName with archived exclusion by default", () => {
    expect(findCustomerByNormalizedName(sample, "مؤسسة الأفق")).toBeUndefined();
    expect(findCustomerByNormalizedName(sample, "مؤسسة الأفق", { includeArchived: true })?.id).toBe("c2");
  });
});

describe("findOrCreateCustomerByName", () => {
  beforeEach(() => {
    // Keep any pre-existing test isolation clean by using unique customer names per test
    expect(Array.isArray(getCustomersSnapshot())).toBe(true);
  });

  it("creates a new customer when none matches and reuses without duplication afterwards", async () => {
    const uniqueName = `عميل اختبار ${Date.now()}-أحمد`;
    const first = await findOrCreateCustomerByName({
      name: uniqueName,
      phone: "0998877665",
      type: "company",
    });

    expect(first.created).toBe(true);
    expect(first.unarchived).toBe(false);
    expect(first.customer.phone).toBe("0998877665");

    const variantName = uniqueName.replace("أحمد", "احمد");
    const second = await findOrCreateCustomerByName({
      name: variantName,
      type: "client",
    });

    expect(second.created).toBe(false);
    expect(second.customer.id).toBe(first.customer.id);
  });

  it("unarchives a matching archived customer and enriches missing phone", async () => {
    const uniqueName = `شركة مؤرشفة ${Date.now()}`;
    const created = await addCustomer({
      name: uniqueName,
      phone: "",
      type: "institution",
      address: "",
      balance: 0,
    });
    await archiveCustomer(created.id);

    const restored = await findOrCreateCustomerByName({
      name: uniqueName.replace("شركة", "شركه"),
      phone: "0912000111",
    });

    expect(restored.created).toBe(false);
    expect(restored.unarchived).toBe(true);
    expect(restored.customer.id).toBe(created.id);
    expect(restored.customer.isArchived).toBe(false);
    expect(restored.customer.phone).toBe("0912000111");
  });
});
