import { useEffect, useRef, useState } from "react";
import { Form, data, useNavigation } from "react-router";
import type { Route } from "./+types/admin._index";
import { getDb } from "../db/client";
import {
  createLink,
  deleteLink,
  getAllLinks,
  moveLink,
  updateLink,
} from "../lib/admin-links";
import type { Link } from "../db/schema";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Links — Hy-An Admin" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const allLinks = await getAllLinks(db);
  return { links: allLinks };
}

type ActionData =
  | { ok: true; intent: string }
  | { ok: false; intent: string; error: string };

export async function action({ context, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const db = getDb(context.cloudflare.env.DB);

  switch (intent) {
    case "create": {
      const result = await createLink(db, {
        slug: String(formData.get("slug") ?? ""),
        label: String(formData.get("label") ?? ""),
        url: String(formData.get("url") ?? ""),
      });
      if (!result.ok) {
        return data<ActionData>(
          { ok: false, intent, error: result.error },
          { status: result.status }
        );
      }
      return { ok: true as const, intent };
    }

    case "update": {
      const id = Number(formData.get("id"));
      const result = await updateLink(db, id, {
        slug: String(formData.get("slug") ?? ""),
        label: String(formData.get("label") ?? ""),
        url: String(formData.get("url") ?? ""),
      });
      if (!result.ok) {
        return data<ActionData>(
          { ok: false, intent, error: result.error },
          { status: result.status }
        );
      }
      return { ok: true as const, intent };
    }

    case "toggle": {
      const id = Number(formData.get("id"));
      const currentEnabled = formData.get("currentEnabled") === "true";
      const result = await updateLink(db, id, { enabled: !currentEnabled });
      if (!result.ok) {
        return data<ActionData>(
          { ok: false, intent, error: result.error },
          { status: result.status }
        );
      }
      return { ok: true as const, intent };
    }

    case "delete": {
      const id = Number(formData.get("id"));
      const result = await deleteLink(db, id);
      if (!result.ok) {
        return data<ActionData>(
          { ok: false, intent, error: result.error },
          { status: result.status }
        );
      }
      return { ok: true as const, intent };
    }

    case "moveUp":
    case "moveDown": {
      const id = Number(formData.get("id"));
      const result = await moveLink(
        db,
        id,
        intent === "moveUp" ? "up" : "down"
      );
      if (!result.ok) {
        return data<ActionData>(
          { ok: false, intent, error: result.error },
          { status: result.status }
        );
      }
      return { ok: true as const, intent };
    }

    default:
      return data<ActionData>(
        { ok: false, intent: "unknown", error: "Unknown action." },
        { status: 400 }
      );
  }
}

export default function AdminLinks({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { links } = loaderData;
  const [editingId, setEditingId] = useState<number | null>(null);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const addFormRef = useRef<HTMLFormElement>(null);

  const editingLink = editingId
    ? links.find((l) => l.id === editingId) ?? null
    : null;

  // Close edit modal after a successful update
  useEffect(() => {
    if (
      actionData &&
      "ok" in actionData &&
      actionData.ok &&
      actionData.intent === "update"
    ) {
      setEditingId(null);
    }
  }, [actionData]);

  // Reset add-link form after a successful create
  useEffect(() => {
    if (
      actionData &&
      "ok" in actionData &&
      actionData.ok &&
      actionData.intent === "create"
    ) {
      addFormRef.current?.reset();
    }
  }, [actionData]);

  const createError =
    actionData &&
    "ok" in actionData &&
    !actionData.ok &&
    actionData.intent === "create"
      ? actionData.error
      : null;

  const rowError =
    actionData &&
    "ok" in actionData &&
    !actionData.ok &&
    ["toggle", "delete", "moveUp", "moveDown"].includes(actionData.intent)
      ? actionData.error
      : null;

  const updateError =
    actionData &&
    "ok" in actionData &&
    !actionData.ok &&
    actionData.intent === "update"
      ? actionData.error
      : null;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Links</h1>
      <p className="text-gray-600 mb-6">
        Add, edit, reorder, enable/disable, and delete the buttons that show on
        the public page.
      </p>

      {/* Add link form */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Add a link</h2>
        <Form
          method="post"
          action="?index"
          ref={addFormRef}
          className="space-y-3"
        >
          <input type="hidden" name="intent" value="create" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-700 mb-1">
                Slug
              </span>
              <input
                type="text"
                name="slug"
                required
                pattern="^[a-z0-9-]+$"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                placeholder="instagram"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-700 mb-1">
                Label
              </span>
              <input
                type="text"
                name="label"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                placeholder="Instagram"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-700 mb-1">
                URL
              </span>
              <input
                type="url"
                name="url"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
                placeholder="https://instagram.com/your-handle"
              />
            </label>
          </div>
          {createError && (
            <p className="text-red-600 text-sm" role="alert">
              {createError}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
          >
            {isSubmitting && navigation.formData?.get("intent") === "create"
              ? "Adding…"
              : "Add link"}
          </button>
        </Form>
      </div>

      {/* Row-level errors (toggle / delete / move) — show above the table */}
      {rowError && (
        <p
          className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-md border border-red-200"
          role="alert"
        >
          {rowError}
        </p>
      )}

      {/* Links table */}
      {links.length === 0 ? (
        <p className="text-gray-500 italic">
          No links yet. Add one above.
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-20">Order</th>
                <th className="px-3 py-2 text-left font-medium">Slug</th>
                <th className="px-3 py-2 text-left font-medium">Label</th>
                <th className="px-3 py-2 text-left font-medium">URL</th>
                <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                <th className="px-3 py-2 text-right font-medium w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {links.map((link, idx) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  isFirst={idx === 0}
                  isLast={idx === links.length - 1}
                  onEdit={() => setEditingId(link.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editingLink && (
        <EditModal
          link={editingLink}
          error={updateError}
          isSubmitting={
            isSubmitting && navigation.formData?.get("intent") === "update"
          }
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}

function LinkRow({
  link,
  isFirst,
  isLast,
  onEdit,
}: {
  link: Link;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
}) {
  return (
    <tr className={link.enabled ? "" : "bg-gray-50 text-gray-500"}>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Form method="post" action="?index" className="inline">
            <input type="hidden" name="intent" value="moveUp" />
            <input type="hidden" name="id" value={link.id} />
            <button
              type="submit"
              disabled={isFirst}
              aria-label="Move up"
              className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-100"
            >
              ↑
            </button>
          </Form>
          <Form method="post" action="?index" className="inline">
            <input type="hidden" name="intent" value="moveDown" />
            <input type="hidden" name="id" value={link.id} />
            <button
              type="submit"
              disabled={isLast}
              aria-label="Move down"
              className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30 hover:bg-gray-100"
            >
              ↓
            </button>
          </Form>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{link.slug}</td>
      <td className="px-3 py-2">{link.label}</td>
      <td className="px-3 py-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
          title={link.url}
        >
          {link.url}
        </a>
      </td>
      <td className="px-3 py-2">
        <Form method="post" action="?index" className="inline">
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="id" value={link.id} />
          <input
            type="hidden"
            name="currentEnabled"
            value={String(link.enabled)}
          />
          <button
            type="submit"
            className={`px-2 py-1 text-xs rounded font-medium ${
              link.enabled
                ? "bg-green-100 text-green-800 hover:bg-green-200"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {link.enabled ? "Enabled" : "Disabled"}
          </button>
        </Form>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
          >
            Edit
          </button>
          <Form
            method="post"
            action="?index"
            className="inline"
            onSubmit={(e) => {
              if (
                !window.confirm(`Delete "${link.label}" (${link.slug})?`)
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={link.id} />
            <button
              type="submit"
              className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
            >
              Delete
            </button>
          </Form>
        </div>
      </td>
    </tr>
  );
}

function EditModal({
  link,
  error,
  isSubmitting,
  onClose,
}: {
  link: Link;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10"
      role="dialog"
      aria-labelledby="edit-modal-title"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="edit-modal-title"
          className="text-lg font-semibold text-gray-900 mb-4"
        >
          Edit link
        </h2>
        <Form method="post" action="/admin?index" className="space-y-3">
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="id" value={link.id} />
          <label className="block">
            <span className="block text-xs font-medium text-gray-700 mb-1">
              Slug
            </span>
            <input
              type="text"
              name="slug"
              defaultValue={link.slug}
              required
              pattern="^[a-z0-9-]+$"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-700 mb-1">
              Label
            </span>
            <input
              type="text"
              name="label"
              defaultValue={link.label}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-700 mb-1">
              URL
            </span>
            <input
              type="url"
              name="url"
              defaultValue={link.url}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </label>
          {error && (
            <p className="text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
