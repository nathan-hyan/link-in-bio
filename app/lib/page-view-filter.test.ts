import { describe, expect, it } from "vitest";
import { shouldLogPageView } from "./page-view-filter";

const BROWSER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("shouldLogPageView", () => {
  it("logs a real visit to the root with a normal browser", () => {
    expect(shouldLogPageView({ rawPath: "", userAgent: BROWSER })).toBe(true);
  });

  it("logs an unmatched but slug-shaped path (e.g. an old campaign slug)", () => {
    expect(
      shouldLogPageView({ rawPath: "summer-sale", userAgent: BROWSER })
    ).toBe(true);
  });

  it("drops credential-probe paths that can't be valid slugs", () => {
    for (const probe of [
      ".env",
      ".env.production",
      ".envrc",
      "config.json",
      "sitemap.xml",
      ".git/config",
      "wp-login.php",
    ]) {
      expect(shouldLogPageView({ rawPath: probe, userAgent: BROWSER })).toBe(
        false
      );
    }
  });

  it("drops known bots and scanners by user-agent even on valid paths", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "TLM-Audit-Scanner/1.0",
      "Go-http-client/1.1",
      "Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)",
      "Mozilla/5.0 (l9scan/2.0; +https://leakix.net)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ]) {
      expect(shouldLogPageView({ rawPath: "", userAgent: ua })).toBe(false);
    }
  });

  it("logs when the user-agent header is absent (conservative)", () => {
    expect(shouldLogPageView({ rawPath: "", userAgent: null })).toBe(true);
  });
});
