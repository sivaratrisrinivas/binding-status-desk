import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { getConvexUrl } from "@convex-dev/static-hosting";
import App from "./App";
import "./index.css";

function convexUrl(): string | null {
  if (import.meta.env.VITE_CONVEX_URL) return import.meta.env.VITE_CONVEX_URL;
  try {
    return getConvexUrl();
  } catch {
    return null;
  }
}

const url = convexUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {url ? (
      <ConvexProvider client={new ConvexReactClient(url)}>
        <App />
      </ConvexProvider>
    ) : (
      <main className="shell">
        <h1>Binding Status Desk</h1>
        <p>
          This build is missing <code>VITE_CONVEX_URL</code>. Run{" "}
          <code>npx convex dev</code> locally or{" "}
          <code>npm run deploy</code> after Convex login so the site can talk
          to the backend.
        </p>
        <p className="disclaimer">
          Plain-language status watching of the public USCIS Case Status Online
          page. Not legal advice. Not affiliated with USCIS or DHS.
        </p>
      </main>
    )}
  </StrictMode>,
);
