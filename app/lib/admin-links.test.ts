import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { links } from "../db/schema";
import {
  createLink,
  deleteLink,
  getAllLinks,
  moveLink,
  updateLink,
} from "./admin-links";

const db = getDb(env.DB);

beforeEach(async () => {
  await db.delete(links);
});

async function seed(rows: { slug: string; label: string; url: string; position: number; enabled?: boolean }[]) {
  await db.insert(links).values(
    rows.map((r) => ({
      slug: r.slug,
      label: r.label,
      url: r.url,
      position: r.position,
      enabled: r.enabled ?? true,
    }))
  );
}

describe("createLink", () => {
  it("creates a link with auto-assigned position 1 in an empty table", async () => {
    const result = await createLink(db, {
      slug: "instagram",
      label: "Instagram",
      url: "https://instagram.com/x",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("instagram");
      expect(result.data.position).toBe(1);
      expect(result.data.enabled).toBe(true);
    }
  });

  it("auto-assigns position = max + 1", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 5 },
    ]);
    const result = await createLink(db, {
      slug: "c",
      label: "C",
      url: "https://c.com",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.position).toBe(6);
  });

  it("rejects duplicate slug", async () => {
    await seed([{ slug: "instagram", label: "IG", url: "https://x.com", position: 1 }]);
    const result = await createLink(db, {
      slug: "instagram",
      label: "Instagram 2",
      url: "https://y.com",
    });
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("rejects invalid slug pattern (uppercase)", async () => {
    const result = await createLink(db, {
      slug: "Instagram",
      label: "IG",
      url: "https://x.com",
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects invalid slug pattern (spaces or special chars)", async () => {
    const r1 = await createLink(db, { slug: "in sta", label: "L", url: "https://x.com" });
    expect(r1).toMatchObject({ ok: false, status: 400 });
    const r2 = await createLink(db, { slug: "in@sta", label: "L", url: "https://x.com" });
    expect(r2).toMatchObject({ ok: false, status: 400 });
  });

  it.each(["admin", "out", "api", "settings"])(
    "rejects reserved slug %s",
    async (reserved) => {
      const result = await createLink(db, {
        slug: reserved,
        label: "X",
        url: "https://x.com",
      });
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
  );

  it("rejects empty label", async () => {
    const result = await createLink(db, {
      slug: "x",
      label: "  ",
      url: "https://x.com",
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects URL that's not parseable", async () => {
    const result = await createLink(db, {
      slug: "x",
      label: "X",
      url: "not a url",
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("trims whitespace from inputs", async () => {
    const result = await createLink(db, {
      slug: "  instagram  ",
      label: "  Instagram  ",
      url: "  https://x.com  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("instagram");
      expect(result.data.label).toBe("Instagram");
      expect(result.data.url).toBe("https://x.com");
    }
  });
});

describe("updateLink", () => {
  it("updates label", async () => {
    await seed([{ slug: "a", label: "Old", url: "https://a.com", position: 1 }]);
    const [link] = await db.select().from(links);
    const result = await updateLink(db, link.id, { label: "New" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.label).toBe("New");
  });

  it("updates url with validation", async () => {
    await seed([{ slug: "a", label: "A", url: "https://a.com", position: 1 }]);
    const [link] = await db.select().from(links);
    const r1 = await updateLink(db, link.id, { url: "not a url" });
    expect(r1).toMatchObject({ ok: false, status: 400 });
    const r2 = await updateLink(db, link.id, { url: "https://new.com" });
    expect(r2.ok).toBe(true);
  });

  it("updates slug to a non-conflicting one", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await updateLink(db, aRow.id, { slug: "alpha" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.slug).toBe("alpha");
  });

  it("rejects slug update that collides with another link", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await updateLink(db, aRow.id, { slug: "b" });
    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("allows slug update to the same value (no collision with self)", async () => {
    await seed([{ slug: "a", label: "A", url: "https://a.com", position: 1 }]);
    const aRow = (await db.select().from(links))[0];
    const result = await updateLink(db, aRow.id, { slug: "a", label: "Alpha" });
    expect(result.ok).toBe(true);
  });

  it("rejects update to a reserved slug", async () => {
    await seed([{ slug: "a", label: "A", url: "https://a.com", position: 1 }]);
    const aRow = (await db.select().from(links))[0];
    const result = await updateLink(db, aRow.id, { slug: "admin" });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("toggles enabled when other enabled links exist", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1, enabled: true },
      { slug: "b", label: "B", url: "https://b.com", position: 2, enabled: true },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await updateLink(db, aRow.id, { enabled: false });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.enabled).toBe(false);
  });

  it("rejects disabling the last enabled link (last-link guard)", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1, enabled: true },
      { slug: "b", label: "B", url: "https://b.com", position: 2, enabled: false },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await updateLink(db, aRow.id, { enabled: false });
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("allows re-enabling a disabled link even when no other enabled exist", async () => {
    await seed([{ slug: "a", label: "A", url: "https://a.com", position: 1, enabled: false }]);
    const aRow = (await db.select().from(links))[0];
    const result = await updateLink(db, aRow.id, { enabled: true });
    expect(result.ok).toBe(true);
  });

  it("returns 404 for an unknown id", async () => {
    const result = await updateLink(db, 999, { label: "X" });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("deleteLink", () => {
  it("deletes an existing link", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await deleteLink(db, aRow.id);
    expect(result.ok).toBe(true);
    const remaining = await db.select().from(links);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].slug).toBe("b");
  });

  it("rejects deleting the last enabled link (last-link guard)", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1, enabled: true },
      { slug: "b", label: "B", url: "https://b.com", position: 2, enabled: false },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await deleteLink(db, aRow.id);
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("allows deleting a disabled link even when 0 enabled links exist", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1, enabled: false },
      { slug: "b", label: "B", url: "https://b.com", position: 2, enabled: false },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await deleteLink(db, aRow.id);
    expect(result.ok).toBe(true);
  });

  it("returns 404 for an unknown id", async () => {
    const result = await deleteLink(db, 999);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("moveLink", () => {
  it("swaps positions when moving up from middle", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
      { slug: "c", label: "C", url: "https://c.com", position: 3 },
    ]);
    const bRow = (await db.select().from(links)).find((l) => l.slug === "b")!;
    const result = await moveLink(db, bRow.id, "up");
    expect(result.ok).toBe(true);

    const all = await getAllLinks(db);
    expect(all.map((l) => l.slug)).toEqual(["b", "a", "c"]);
  });

  it("swaps positions when moving down from middle", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
      { slug: "c", label: "C", url: "https://c.com", position: 3 },
    ]);
    const bRow = (await db.select().from(links)).find((l) => l.slug === "b")!;
    const result = await moveLink(db, bRow.id, "down");
    expect(result.ok).toBe(true);

    const all = await getAllLinks(db);
    expect(all.map((l) => l.slug)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op when moving the first link up", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
    ]);
    const aRow = (await db.select().from(links)).find((l) => l.slug === "a")!;
    const result = await moveLink(db, aRow.id, "up");
    expect(result.ok).toBe(true);

    const all = await getAllLinks(db);
    expect(all.map((l) => l.slug)).toEqual(["a", "b"]);
  });

  it("is a no-op when moving the last link down", async () => {
    await seed([
      { slug: "a", label: "A", url: "https://a.com", position: 1 },
      { slug: "b", label: "B", url: "https://b.com", position: 2 },
    ]);
    const bRow = (await db.select().from(links)).find((l) => l.slug === "b")!;
    const result = await moveLink(db, bRow.id, "down");
    expect(result.ok).toBe(true);

    const all = await getAllLinks(db);
    expect(all.map((l) => l.slug)).toEqual(["a", "b"]);
  });

  it("returns 404 for an unknown id", async () => {
    const result = await moveLink(db, 999, "up");
    expect(result).toMatchObject({ ok: false, status: 404 });
  });
});

describe("getAllLinks", () => {
  it("returns enabled and disabled links sorted by position", async () => {
    await seed([
      { slug: "c", label: "C", url: "https://c.com", position: 3, enabled: true },
      { slug: "a", label: "A", url: "https://a.com", position: 1, enabled: false },
      { slug: "b", label: "B", url: "https://b.com", position: 2, enabled: true },
    ]);
    const result = await getAllLinks(db);
    expect(result.map((l) => l.slug)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for an empty table", async () => {
    expect(await getAllLinks(db)).toEqual([]);
  });
});
