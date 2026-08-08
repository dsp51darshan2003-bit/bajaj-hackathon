import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || " https://tucking-yelp-uncork.ngrok-free.dev";
const DOC_NAME = import.meta.env.VITE_DOC_NAME || "your document";

const TYPE_LABEL = { text: "TEXT", table: "TABLE", image: "IMAGE" };

function ResultCard({ result, rank }) {
  const [expanded, setExpanded] = useState(false);
  const meta = result.metadata || {};
  const text = meta.text || "";
  const isLong = text.length > 320;
  const shown = expanded || !isLong ? text : text.slice(0, 320) + "…";
  const scorePct = result.norm_score != null ? Math.round(result.norm_score * 100) : null;

  return (
    <div className="result-card">
      <div className="result-card-header">
        <span className="result-rank">#{rank}</span>
        <span className={`result-type-badge type-${meta.type || "text"}`}>
          {TYPE_LABEL[meta.type] || "TEXT"}
        </span>
        {scorePct != null && <span className="result-score">{scorePct}% match</span>}
        <span className="result-page">p.{meta.page ?? "?"}</span>
      </div>

      {meta.section && (
        <div className="result-section">{meta.section}</div>
      )}

      <p className="result-text">{shown}</p>

      {isLong && (
        <button className="result-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "show less" : "show more"}
        </button>
      )}

      <div className="result-source">{meta.source}</div>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runSearch(e) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError("Couldn't reach the backend. Check that the API is running and reachable.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-page">
      <form className="search-bar" onSubmit={runSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search raw chunks in ${DOC_NAME}`}
          disabled={loading}
        />
        <label className="topk-label">
          top_k
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value) || 1)}
            className="topk-input"
            disabled={loading}
          />
        </label>
        <button type="submit" className="search-btn" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {!error && results === null && !loading && (
        <div className="empty-state">
          <h1>Inspect raw retrieval</h1>
          <p>
            This queries <code>/search</code> directly — no LLM summarization,
            just the top-{topK} matched chunks (text, table, or image) with
            their relevance score and section.
          </p>
        </div>
      )}

      {loading && (
        <div className="msg-assistant pending">
          <span className="dots"><span /><span /><span /></span>
        </div>
      )}

      {results !== null && !loading && (
        <div className="results-list">
          {results.length === 0 && <p>No results found.</p>}
          {results.map((r, i) => (
            <ResultCard key={r.index ?? i} result={r} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
