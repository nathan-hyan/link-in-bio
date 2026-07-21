import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateImageUpload } from "./media-upload";

describe("validateImageUpload", () => {
  it("accepts a normal png/jpeg/webp under the size limit", () => {
    for (const contentType of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validateImageUpload({ contentType, size: 500_000 })).toBeNull();
    }
  });

  it("rejects a missing/empty file", () => {
    expect(validateImageUpload({ contentType: "image/png", size: 0 })).toBe(
      "Choose an image file to upload."
    );
  });

  it("rejects non-image content types", () => {
    for (const contentType of ["application/pdf", "text/html", ""]) {
      expect(
        validateImageUpload({ contentType, size: 1000 })
      ).toBe("File must be a PNG, JPEG, WebP, GIF, or AVIF image.");
    }
  });

  it("rejects files over the size limit", () => {
    expect(
      validateImageUpload({ contentType: "image/png", size: MAX_UPLOAD_BYTES + 1 })
    ).toBe("Image is too large (max 5 MB).");
  });

  it("accepts a file exactly at the size limit", () => {
    expect(
      validateImageUpload({ contentType: "image/png", size: MAX_UPLOAD_BYTES })
    ).toBeNull();
  });
});
