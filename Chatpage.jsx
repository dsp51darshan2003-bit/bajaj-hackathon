import { useState, useRef, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";
const DOC_NAME = import.meta.env.VITE_DOC_NAME || "your document";

const STARTER_QUESTIONS = [
  "What's my total EMI across all my loans?",
  "Have I had any missed payments?",
  "What is the Total Expense Ratio of the Large Cap Fund?",
  "Compare the exit load of two funds",
];

const INTENT_LABEL = {
  loan_account: "Loan account",
  mutual_fund: "Mutual fund",
  unclear: "Unclear",
};

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IntentTag({ intent }) {
  if (!intent || intent === "unclear") return null;
  return <span className={`intent-tag intent-${intent}`}>{INTENT_LABEL[intent]}</span>;
}

function SourceChips({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div>
      <button className="sources-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "hide sources" : `${sources.length} source${sources.length > 1 ? "s" : ""}`}
      </button>
      {open && (
        <div className="source-chips">
          {sources.map((s, i) => (
            <span key={i} style={{ display: "inline-flex", gap: "4px" }}>
              {s.type === "loan_data" ? (
                <span className="source-chip loan">account data · {s.tool}</span>
              ) : (
                <>
                  <span className="source-chip page">p.{s.page}</span>
                  {s.section && <span className="source-chip section">{s.section.split(" | ")[0]}</span>}
                </>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CrossSellBubble({ text, onExplore }) {
  return (
    <div className="msg-row">
      <div className="pitch-bubble">
        <p>{text}</p>
        <button className="pitch-cta" onClick={onExplore}>Tell me more</button>
      </div>
    </div>
  );
}

function CustomerGate({ onLogin }) {
  const [mobile, setMobile] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (mobile.trim()) onLogin(mobile.trim());
  }

  return (
    <div className="empty-state">
      <h1>Sign in to your account</h1>
      <p>Enter your registered mobile number to ask about your loans, or ask a general mutual fund question.</p>
      <form className="gate-form" onSubmit={handleSubmit}>
        <input
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="Registered mobile number"
          autoFocus
        />
        <button type="submit" disabled={!mobile.trim()}>Continue</button>
      </form>
    </div>
  );
}

export default function ChatPage({ customerId, onLogin, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef(null);
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function ask(query) {
    if (!query.trim() || loading || !customerId) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, query, session_id: sessionIdRef.current }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          intent: data.intent,
          latencyMs: data.total_latency_ms,
          crossSellPitch: data.cross_sell_pitch || null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "Couldn't reach the backend. Check that the API is running and reachable." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    ask(input);
  }

  if (!customerId) {
    return (
      <div className="thread">
        <CustomerGate onLogin={onLogin} />
      </div>
    );
  }

  return (
    <>
      <div className="chat-subheader">
        <span>Signed in as {customerId}</span>
        <button className="link-btn" onClick={onLogout}>Switch account</button>
      </div>

      <div className="thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <h1>Ask about your account or {DOC_NAME}</h1>
            <p>Loan questions are answered from your account data. Fund questions are grounded in the factsheet.</p>
            <div className="starter-chips">
              {STARTER_QUESTIONS.map((q) => (
                <button key={q} className="chip" onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="msg-row user">
                <div className="bubble-user">{m.content}</div>
              </div>
            );
          }
          if (m.role === "error") {
            return (
              <div key={i} className="msg-row">
                <div className="error-msg">{m.content}</div>
              </div>
            );
          }
          return (
            <div key={i}>
              <div className="msg-row">
                <div className="msg-assistant">
                  <IntentTag intent={m.intent} />
                  <p>{m.content}</p>
                  <div className="msg-footer">
                    <SourceChips sources={m.sources} />
                    {m.latencyMs != null && (
                      <span className="latency-note">{Math.round(m.latencyMs)}ms</span>
                    )}
                  </div>
                </div>
              </div>
              {m.crossSellPitch && (
                <CrossSellBubble
                  text={m.crossSellPitch}
                  onExplore={() => ask("Tell me more about mutual fund options for me")}
                />
              )}
            </div>
          );
        })}

        {loading && (
          <div className="msg-row">
            <div className="msg-assistant pending">
              <p>
                <span className="dots"><span /><span /><span /></span>
              </p>
            </div>
          </div>
        )}
      </div>

      <form className="input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your loans or a mutual fund"
          disabled={loading}
        />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()} aria-label="Send">
          <SendIcon />
        </button>
      </form>
    </>
  );
}