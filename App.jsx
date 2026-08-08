import { useState, useEffect } from "react";
import ChatPage from "./ChatPage.jsx";
import SearchPage from "./SearchPage.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";
const DOC_NAME = import.meta.env.VITE_DOC_NAME || "your document";
const CUSTOMER_STORAGE_KEY = "folio_customer_id";

function MetricsTicker() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_URL}/metrics?hours=24`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMetrics(data);
      } catch {
        // silent -- metrics are a nice-to-have, not worth surfacing an error for
      }
    }

    poll();
    const id = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!metrics || !metrics.calls) return null;

  return (
    <div className="metrics-ticker" title="LLM calls, tokens, and avg latency in the last 24h">
      {metrics.calls} calls · {metrics.total_tokens} tokens · {Math.round(metrics.avg_latency_ms)}ms avg
    </div>
  );
}

export default function App() {
  const [connected, setConnected] = useState(null); // null = checking, true/false after
  const [tab, setTab] = useState("chat"); // "chat" | "search"
  const [customerId, setCustomerId] = useState(() => localStorage.getItem(CUSTOMER_STORAGE_KEY) || null);

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then((r) => (r.ok ? setConnected(true) : setConnected(false)))
      .catch(() => setConnected(false));
  }, []);

  function handleLogin(mobile) {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, mobile);
    setCustomerId(mobile);
  }

  function handleLogout() {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    setCustomerId(null);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-name">Folio</span>
          <span className="doc-name">{DOC_NAME}</span>
        </div>

        <nav className="tab-nav">
          <button
            className={`tab-btn ${tab === "chat" ? "active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            className={`tab-btn ${tab === "search" ? "active" : ""}`}
            onClick={() => setTab("search")}
          >
            Raw Search
          </button>
        </nav>

        <MetricsTicker />

        <div className="status">
          <span
            className={`status-dot ${connected === true ? "connected" : connected === false ? "error" : ""}`}
          />
          {connected === null ? "Checking..." : connected ? "Connected" : "Offline"}
        </div>
      </header>

      {tab === "chat" ? (
        <ChatPage customerId={customerId} onLogin={handleLogin} onLogout={handleLogout} />
      ) : (
        <SearchPage />
      )}
    </div>
  );
}