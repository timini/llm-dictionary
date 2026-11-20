"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Never send uploaded talk IDs, prompts, words, URL queries, or fragments.
export function analyticsPath(pathname: string): string {
  return pathname === "/" ? "/" : "/other";
}

export function Analytics() {
  const pathname = usePathname();
  const lastLocation = useRef<string | null>(null);

  useEffect(() => {
    // Build-time configuration. Missing configuration leaves analytics disabled.
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const hostname = process.env.NEXT_PUBLIC_GA_HOSTNAME;
    if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId) || !hostname)
      return;
    if (window.location.hostname !== hostname) return;
    const pageLocation = `https://${hostname}${analyticsPath(pathname || "/")}`;
    if (lastLocation.current === pageLocation) return;
    lastLocation.current = pageLocation;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        // The Google tag command queue expects the function's Arguments object.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
    const page = {
      page_location: pageLocation,
      page_title: "LLM Dictionary",
      page_referrer: "",
    };
    window.gtag("set", page);
    if (!document.getElementById("basic-google-analytics")) {
      window.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        ...page,
      });
      const script = document.createElement("script");
      script.id = "basic-google-analytics";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }
    window.gtag("event", "page_view", { ...page, send_to: measurementId });
  }, [pathname]);

  return null;
}
