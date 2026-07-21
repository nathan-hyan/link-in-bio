import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/admin.settings";
import { getDb } from "../db/client";
import {
  BG_IMAGE_PATH,
  BG_KV_KEY,
  validateImageUpload,
} from "../lib/media-upload";
import {
  SETTING_BG_IMAGE_URL,
  SETTING_LATEST_VIDEO_ID,
  SETTING_LATEST_VIDEO_TITLE,
  getBgImageUrl,
  getLatestVideo,
  setSetting,
} from "../lib/settings";
import { YOUTUBE_CHANNEL_ID, fetchLatestVideo } from "../lib/youtube";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Settings — Hy-An Admin" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const [bgImageUrl, latestVideo] = await Promise.all([
    getBgImageUrl(db),
    getLatestVideo(db),
  ]);
  return { bgImageUrl, latestVideo };
}

export async function action({ context, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const db = getDb(context.cloudflare.env.DB);

  if (formData.get("intent") === "fetch-video") {
    const video = await fetchLatestVideo();
    if (!video) {
      return {
        videoError: "Couldn't fetch the latest video from the channel.",
      };
    }
    await setSetting(db, SETTING_LATEST_VIDEO_ID, video.id);
    await setSetting(db, SETTING_LATEST_VIDEO_TITLE, video.title);
    return { videoOk: true as const, video };
  }

  const file = formData.get("bgImageFile");

  const contentType = file instanceof File ? file.type : "";
  const size = file instanceof File ? file.size : 0;
  const error = validateImageUpload({ contentType, size });
  if (error || !(file instanceof File)) {
    return { error: error ?? "Choose an image file to upload." };
  }

  // Overwrite the single fixed key — the previous image's bytes are replaced,
  // so only one background ever exists in KV.
  const kv = context.cloudflare.env.MEDIA;
  await kv.put(BG_KV_KEY, await file.arrayBuffer(), {
    metadata: { contentType: file.type },
  });

  // Version the URL so browsers/CDN fetch the new image instead of a cached one.
  await setSetting(db, SETTING_BG_IMAGE_URL, `${BG_IMAGE_PATH}?v=${Date.now()}`);
  return { ok: true as const };
}

export default function AdminSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const submittingIntent =
    navigation.state === "submitting"
      ? navigation.formData?.get("intent")
      : null;
  const isUploading = navigation.state === "submitting" && submittingIntent !== "fetch-video";
  const isFetchingVideo = submittingIntent === "fetch-video";
  const error = actionData && "error" in actionData ? actionData.error : null;
  const success = actionData && "ok" in actionData;
  const videoError =
    actionData && "videoError" in actionData ? actionData.videoError : null;
  const videoOk = actionData && "videoOk" in actionData;
  const latestVideo = loaderData.latestVideo;

  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">
        Site-wide configuration. Changes apply immediately to the public page.
      </p>

      <Form
        method="post"
        encType="multipart/form-data"
        className="space-y-4 max-w-xl"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Background image
          </label>

          <div className="mb-3">
            <img
              src={loaderData.bgImageUrl}
              alt="Current background"
              className="h-32 w-full object-cover rounded-md border border-gray-200 bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">Current background</p>
          </div>

          <input
            type="file"
            name="bgImageFile"
            id="bgImageFile"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer"
            aria-invalid={error ? true : undefined}
            aria-describedby="bgImageFile-help"
          />
          <p id="bgImageFile-help" className="mt-1 text-sm text-gray-500">
            PNG, JPEG, WebP, GIF, or AVIF. Max 5 MB.
          </p>
        </div>

        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="text-green-600 text-sm" role="status">
            Uploaded.
          </p>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
        >
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </Form>

      <hr className="my-8 border-gray-200 max-w-xl" />

      <Form method="post" className="space-y-4 max-w-xl">
        <input type="hidden" name="intent" value="fetch-video" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Latest YouTube video
          </label>

          {latestVideo ? (
            <div className="mb-3">
              <div className="aspect-video w-full max-w-md overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                <iframe
                  src={`https://www.youtube.com/embed/${latestVideo.id}`}
                  title={latestVideo.title || "Latest video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Currently showing:{" "}
                <span className="font-medium">
                  {latestVideo.title || latestVideo.id}
                </span>
              </p>
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-500">
              No video set yet. Fetch the channel to pull the latest upload.
            </p>
          )}

          <p className="text-sm text-gray-500">
            Pulls the newest upload from the Hy-An channel (
            <code className="text-xs">{YOUTUBE_CHANNEL_ID}</code>) and shows it
            on the public page.
          </p>
        </div>

        {videoError && (
          <p className="text-red-600 text-sm" role="alert">
            {videoError}
          </p>
        )}
        {videoOk && !videoError && (
          <p className="text-green-600 text-sm" role="status">
            Updated to the latest video.
          </p>
        )}

        <button
          type="submit"
          disabled={isFetchingVideo}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
        >
          {isFetchingVideo ? "Fetching…" : "Fetch channel"}
        </button>
      </Form>
    </section>
  );
}
