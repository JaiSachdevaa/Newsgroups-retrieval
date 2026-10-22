import { Suspense, lazy, useEffect, useState } from "react";
import SearchPage from "./pages/SearchPage.jsx";
import { Loading } from "./components/State.jsx";

const TopicMap = lazy(() => import("./pages/TopicMap.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Evaluation = lazy(() => import("./pages/Evaluation.jsx"));

const PAGES = [
  { id: "search", label: "Search" },
  { id: "map", label: "Topic map" },
  { id: "analytics", label: "Analytics" },
  { id: "eval", label: "Evaluation" },
];

function ThemeIcon({ dark }) {
  return dark ? (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 11.5A6.5 6.5 0 018.5 3.5a6.5 6.5 0 108 8z" />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState("search");
  const [selected, setSelected] = useState(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("ngr-theme", dark ? "dark" : "light");
    } catch (error) {
      return;
    }
  }, [dark]);

  const openPost = (id) => {
    setSelected({ id });
    setPage("search");
  };

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-line bg-panel px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-mono text-sm font-semibold text-accent-ink">
            ng
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold">Newsgroups Retrieval</p>
            <p className="font-mono text-[10px] text-mute">BM25 + embeddings + RRF</p>
          </div>
        </div>

        <nav className="flex gap-1" aria-label="Pages">
          {PAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                page === item.id
                  ? "bg-accent/15 font-medium text-ink"
                  : "text-mute hover:bg-raised hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setDark(!dark)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-line text-mute transition hover:text-ink"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        >
          <ThemeIcon dark={dark} />
        </button>
      </header>

      <main className="min-h-0 flex-1">
        <div className={page === "search" ? "h-full" : "hidden"}>
          <SearchPage active={page === "search"} selected={selected} onSelect={setSelected} />
        </div>
        <Suspense fallback={<Loading />}>
          {page === "map" && <TopicMap onOpen={openPost} />}
          {page === "analytics" && <Analytics />}
          {page === "eval" && <Evaluation />}
        </Suspense>
      </main>
    </div>
  );
}
