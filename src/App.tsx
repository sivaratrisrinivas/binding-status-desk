import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const DISCLAIMER =
  "Plain-language status watching of the public USCIS Case Status Online page. This is not legal advice. It does not predict outcomes, tell you what to file, or speak for USCIS or DHS. We only restate public website text.";

function normalizeReceipt(value: string): string {
  return value.replace(/[-\s]/g, "").toUpperCase();
}

function formatWhen(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(ts);
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [receipt, setReceipt] = useState(params.get("r") ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receiptNumber = normalizeReceipt(receipt);
  const watched = useQuery(
    api.cases.getByReceipt,
    receiptNumber.length === 13 ? { receiptNumber } : "skip",
  );
  const snapshot = useQuery(
    api.cases.latestSnapshot,
    watched?._id ? { caseId: watched._id } : "skip",
  );
  const diffs = useQuery(
    api.cases.diffsForCase,
    watched?._id ? { caseId: watched._id } : "skip",
  );

  const watch = useMutation(api.cases.watch);
  const pollNow = useMutation(api.cases.pollNow);
  const simulateNext = useMutation(api.cases.simulateNext);

  const waiting = watched && !snapshot && !watched.lastError;

  const subtitle = useMemo(() => {
    if (!watched) return null;
    if (waiting) return "Checking the public page…";
    if (watched.lastError) return watched.lastError;
    if (snapshot) return "Current public status";
    return "No public status stored yet.";
  }, [snapshot, waiting, watched]);

  async function onWatch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await watch({
        receiptNumber,
        notifyEmail: email.trim() || undefined,
      });
      const next = new URL(window.location.href);
      next.searchParams.set("r", result.receiptNumber);
      window.history.replaceState({}, "", next);
      setReceipt(result.receiptNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start watching.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <p className="kicker">Everyday status watching</p>
      <h1>Paste a receipt number. See only what changed.</h1>
      <p className="lede">
        Binding Status Desk watches the public USCIS Case Status Online page
        for you. When the public text changes, you get a timeline of diffs and
        a plain-language restatement — never legal advice.
      </p>

      <form className="panel" onSubmit={onWatch}>
        <label htmlFor="receipt">
          USCIS receipt number
          <span className="hint">
            13 characters. Skip dashes. Example used in the Firecrawl spike:
            IOE0900000001
          </span>
        </label>
        <input
          id="receipt"
          className="receipt"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="EAC1234567890"
          maxLength={16}
          value={receipt}
          onChange={(event) => setReceipt(event.target.value)}
          required
        />

        <label htmlFor="email">
          Email me on real changes
          <span className="hint">
            Optional. Uses AgentMail only when a public status actually diffs.
          </span>
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Starting…" : "Watch this receipt"}
          </button>
          {watched?._id && (
            <button
              className="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                void pollNow({ caseId: watched._id }).catch((err: unknown) => {
                  setError(
                    err instanceof Error ? err.message : "Could not check the public page.",
                  );
                });
              }}
            >
              Check public page now
            </button>
          )}
          {watched?._id && (
            <button
              className="demo"
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                void simulateNext({ caseId: watched._id }).catch((err: unknown) => {
                  setError(
                    err instanceof Error ? err.message : "Could not simulate a change.",
                  );
                });
              }}
            >
              DEMO: simulate a change
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      {watched && (
        <section className="panel status-card">
          <p className="kicker">{watched.receiptNumber}</p>
          <h2>{snapshot?.statusTitle ?? "Waiting for a public snapshot"}</h2>
          <div className="meta">
            {snapshot?.formType && <span className="pill">{snapshot.formType}</span>}
            {snapshot?.eventDate && <span className="pill">{snapshot.eventDate}</span>}
            {snapshot?.source === "simulate" && (
              <span className="pill demo">Simulated demo status</span>
            )}
            {snapshot?.source === "firecrawl" && (
              <span className="pill">Fetched from public Case Status Online</span>
            )}
          </div>
          <p>{snapshot?.description ?? subtitle}</p>
          {watched.lastError && <p className="error">{watched.lastError}</p>}
        </section>
      )}

      {watched && (
        <section className="timeline">
          <h3>Changes only</h3>
          {!diffs && <p className="empty">Loading timeline…</p>}
          {diffs && diffs.length === 0 && (
            <p className="empty">
              No diffs yet. The first public snapshot is the baseline. We only
              add a row when the public text actually changes — or when you
              press DEMO simulate.
            </p>
          )}
          {diffs?.map((diff) => (
            <article className="diff" key={diff._id}>
              <div className="when">
                {formatWhen(diff.createdAt)}
                {diff.simulated ? " · simulated demo" : " · public page"}
              </div>
              <div className="change">
                {diff.beforeTitle ?? "—"} → {diff.afterTitle}
              </div>
              <p>{diff.plainLanguage}</p>
            </article>
          ))}
        </section>
      )}

      <p className="disclaimer">{DISCLAIMER}</p>
    </main>
  );
}
