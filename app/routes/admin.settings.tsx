import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/admin.settings";
import { getDb } from "../db/client";
import {
  DEFAULT_BG_IMAGE_URL,
  SETTING_BG_IMAGE_URL,
  getBgImageUrl,
  setSetting,
} from "../lib/settings";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Settings — Hy-An Admin" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const bgImageUrl = await getBgImageUrl(db);
  return { bgImageUrl };
}

function validateBgImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Background URL cannot be empty.";
  const ok =
    trimmed.startsWith("/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://");
  if (!ok)
    return "URL must start with /, http://, or https://.";
  if (trimmed.length > 2000) return "URL is too long.";
  // The URL gets interpolated into a CSS `url('...')` value on the public
  // page; reject characters that would break out of the string or the
  // declaration. Whitespace is also rejected — legitimate URLs encode it.
  if (/['"<>\\\s]/.test(trimmed)) {
    return "URL contains disallowed characters (no quotes, angle brackets, backslashes, or whitespace).";
  }
  return null;
}

export async function action({ context, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const raw = String(formData.get("bgImageUrl") ?? "");
  const error = validateBgImageUrl(raw);
  if (error) {
    return { error, value: raw };
  }
  const db = getDb(context.cloudflare.env.DB);
  await setSetting(db, SETTING_BG_IMAGE_URL, raw.trim());
  return { ok: true as const };
}

export default function AdminSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "ok" in actionData;

  // After a successful save, re-render the input with the freshly loaded value.
  // After a validation error, re-render with the user's last input so they
  // don't lose what they typed.
  const inputValue =
    error && actionData && "value" in actionData
      ? actionData.value
      : loaderData.bgImageUrl;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">
        Site-wide configuration. Changes apply immediately to the public page.
      </p>

      <Form method="post" className="space-y-4 max-w-xl">
        <div>
          <label
            htmlFor="bgImageUrl"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Background image URL
          </label>
          <input
            type="text"
            name="bgImageUrl"
            id="bgImageUrl"
            defaultValue={inputValue}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 focus:outline-none"
            placeholder="/bg.png or https://example.com/image.jpg"
            aria-invalid={error ? true : undefined}
            aria-describedby="bgImageUrl-help"
          />
          <p id="bgImageUrl-help" className="mt-1 text-sm text-gray-500">
            Use <code className="font-mono">/filename</code> for files in the{" "}
            <code className="font-mono">public/</code> folder, or paste a public{" "}
            <code className="font-mono">https://</code> URL. Default:{" "}
            <code className="font-mono">{DEFAULT_BG_IMAGE_URL}</code>.
          </p>
        </div>

        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="text-green-600 text-sm" role="status">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </Form>
    </section>
  );
}
