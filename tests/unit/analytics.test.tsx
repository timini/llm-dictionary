import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Analytics, analyticsPath } from "../../app/analytics";

const route = vi.hoisted(() => ({ pathname: "/" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

beforeEach(() => {
  route.pathname = "/";
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");
  vi.stubEnv("NEXT_PUBLIC_GA_HOSTNAME", window.location.hostname);
  delete window.gtag;
  delete window.dataLayer;
  document.getElementById("basic-google-analytics")?.remove();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.getElementById("basic-google-analytics")?.remove();
});
const commands = () =>
  (window.dataLayer || []).map((entry) =>
    Array.from(entry as ArrayLike<unknown>),
  );

describe("minimal GA page views", () => {
  it.each([
    ["NEXT_PUBLIC_GA_MEASUREMENT_ID", ""],
    ["NEXT_PUBLIC_GA_MEASUREMENT_ID", "invalid-id"],
    ["NEXT_PUBLIC_GA_HOSTNAME", ""],
    ["NEXT_PUBLIC_GA_HOSTNAME", "another-host.example"],
  ])(
    "does not load analytics with unavailable configuration or on another host: %s=%s",
    (key, value) => {
      vi.stubEnv(key, value);
      render(<Analytics />);
      expect(document.getElementById("basic-google-analytics")).toBeNull();
      expect(window.dataLayer).toBeUndefined();
    },
  );
  it("denies storage and advertising consent before configuration and sends only a sanitized page view", () => {
    const { rerender } = render(<Analytics />);
    const all = commands();
    const consent = all.findIndex((c) => c[0] === "consent");
    const config = all.findIndex((c) => c[0] === "config");
    expect(consent).toBeLessThan(config);
    expect(all[consent]).toEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(all[config]![2]).toMatchObject({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const page = all.find((c) => c[0] === "event")!;
    expect(page).toEqual([
      "event",
      "page_view",
      {
        page_location: `https://${window.location.hostname}/`,
        page_title: "LLM Dictionary",
        page_referrer: "",
        send_to: "G-TEST123",
      },
    ]);
    expect(document.querySelectorAll("#basic-google-analytics")).toHaveLength(
      1,
    );
    rerender(<Analytics />);
    expect(commands().filter((c) => c[0] === "event")).toHaveLength(1);
    route.pathname = "/private-user-content";
    rerender(<Analytics />);
    expect(commands().filter((c) => c[0] === "event")).toHaveLength(2);
    expect(JSON.stringify(commands())).not.toContain("private-user-content");
    expect(document.querySelectorAll("#basic-google-analytics")).toHaveLength(
      1,
    );
    // A different unknown route maps to the same /other page, without another view.
    route.pathname = "/another-private-value";
    rerender(<Analytics />);
    expect(commands().filter((c) => c[0] === "event")).toHaveLength(2);
  });
  it("handles a missing route as the homepage", () => {
    route.pathname = null;
    render(<Analytics />);
    expect(commands().find((c) => c[0] === "event")?.[2]).toMatchObject({
      page_location: `https://${window.location.hostname}/`,
    });
  });
  it("reuses a queue and tag installed by an earlier mount", () => {
    window.dataLayer = [];
    window.gtag = vi.fn();
    const script = document.createElement("script");
    script.id = "basic-google-analytics";
    document.head.appendChild(script);
    render(<Analytics />);
    expect(window.gtag).toHaveBeenCalledWith(
      "event",
      "page_view",
      expect.any(Object),
    );
    expect(document.querySelectorAll("#basic-google-analytics")).toHaveLength(
      1,
    );
  });
  it("does not preserve dynamic paths", () => {
    expect(analyticsPath("/")).toBe("/");
    expect(analyticsPath("/private-word")).toBe("/other");
  });
});
