import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import GroupTree from "../components/GroupTree.jsx";
import SearchBar from "../components/SearchBar.jsx";
import ResultCard from "../components/ResultCard.jsx";
import ThreadPane from "../components/ThreadPane.jsx";
import { GROUPS } from "../lib/groups.js";
import { MODE_BY_ID } from "../lib/modes.js";

const EXAMPLES = [
  "graphics card driver problems",
  "who won the stanley cup",
  "group:sci.crypt clipper chip",
  '"space shuttle" group:sci.space',
  "is it safe to take aspirin",
  "armenian genocide history",
];

function Skeleton() {
  return (
    <div className="space-y-3 pt-4">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="animate-pulse rounded-xl border border-line bg-panel p-4">
          <div className="h-3 w-1/3 rounded bg-line" />
          <div className="mt-3 h-4 w-3/4 rounded bg-line" />
          <div className="mt-3 h-3 w-full rounded bg-line" />
          <div className="mt-2 h-3 w-5/6 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

export default function SearchPage({ active, selected, onSelect }) {
  const [input, setInput] = useState("");
  const [params, setParams] = useState({ q: "", mode: "hybrid", group: "", rerank: false });
  const [showThread, setShowThread] = useState(false);
  const inputRef = useRef(null);

  const enabled = params.q !== "" || params.group !== "";
  const search = useInfiniteQuery({
    queryKey: ["search", params],
    queryFn: ({ pageParam }) => api.search({ ...params, offset: pageParam, limit: 20 }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, page) => count + page.results.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  const pages = search.data?.pages ?? [];
  const results = pages.flatMap((page) => page.results);
  const meta = pages[0];
  const firstId = results[0]?.id;

  const select = (result) =>
    onSelect({
      id: result.id,
      why: result.why,
      mode: meta?.mode ?? params.mode,
      terms: meta?.terms ?? [],
      reranked: Boolean(meta?.reranked),
    });

  const open = (result) => {
    select(result);
    setShowThread(true);
  };

  useEffect(() => {
    if (results.length > 0) select(results[0]);
  }, [firstId, params]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && typing) {
        document.activeElement.blur();
        return;
      }
      if (typing || results.length === 0) return;
      if (event.key === "j" || event.key === "k") {
        const index = results.findIndex((result) => result.id === selected?.id);
        const step = event.key === "j" ? 1 : -1;
        const next = results[Math.min(Math.max(index + step, 0), results.length - 1)];
        select(next);
        document.getElementById(`result-${next.id}`)?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = (q) => setParams((current) => ({ ...current, q: q.trim() }));
  const run = (q) => {
    setInput(q);
    submit(q);
  };

  const filters = meta?.filters;
  const chips = [
    ...(params.group ? [{ label: `group ${params.group}`, clear: () => setParams((p) => ({ ...p, group: "" })) }] : []),
    ...(filters?.groups ?? []).map((value) => ({ label: `group: ${value}` })),
    ...(filters?.authors ?? []).map((value) => ({ label: `from: ${value}` })),
    ...(filters?.phrases ?? []).map((value) => ({ label: `phrase "${value}"` })),
  ];

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className="hidden min-h-0 overflow-y-auto border-r border-line bg-panel lg:block">
        <GroupTree
          activeGroup={params.group}
          onSelect={(group) => setParams((current) => ({ ...current, group }))}
        />
      </aside>

      <section className="flex min-h-0 flex-col border-r border-line">
        <SearchBar
          value={input}
          onChange={setInput}
          onSubmit={submit}
          mode={params.mode}
          onMode={(mode) => setParams((current) => ({ ...current, mode }))}
          rerank={params.rerank}
          onRerank={(rerank) => setParams((current) => ({ ...current, rerank }))}
          inputRef={inputRef}
        />

        <div className="border-b border-line bg-panel px-4 py-2 lg:hidden">
          <select
            value={params.group}
            onChange={(event) => setParams((current) => ({ ...current, group: event.target.value }))}
            className="w-full rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-xs"
            aria-label="Filter by newsgroup"
          >
            <option value="">All groups</option>
            {GROUPS.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
          {!enabled && (
            <div className="mx-auto max-w-md py-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 font-mono text-lg text-accent">
                ng
              </div>
              <h2 className="text-lg font-semibold">Search the 20 Newsgroups archive</h2>
              <p className="mt-1 text-sm text-mute">
                Ask in plain language, search by keyword, or narrow with operators. Pick a group on
                the left to browse it.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => run(example)}
                    className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs transition hover:border-accent"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {enabled && search.isLoading && <Skeleton />}

          {enabled && search.error && (
            <div className="mt-6 rounded-xl border border-line bg-panel p-4 text-sm">
              <p className="font-semibold">Search failed</p>
              <p className="mt-1 text-mute">{search.error.message}</p>
              <p className="mt-2 font-mono text-xs text-mute">
                Is the API running on port 8000?
              </p>
            </div>
          )}

          {enabled && meta && (
            <>
              <div className="flex flex-wrap items-center gap-2 py-3 text-xs text-mute">
                <span>
                  <b className="text-ink">
                    {meta.total.toLocaleString()}
                    {meta.capped ? "+" : ""}
                  </b>{" "}
                  {meta.total === 1 ? "post" : "posts"}
                  {meta.query ? ` in ${meta.took_ms} ms` : ""}
                  {meta.query ? ` · ${MODE_BY_ID[meta.mode]?.label}${meta.reranked ? " + rerank" : ""}` : " · browsing"}
                </span>
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 font-mono text-[11px]"
                  >
                    {chip.label}
                    {chip.clear && (
                      <button type="button" onClick={chip.clear} aria-label="Remove filter" className="text-mute hover:text-ink">
                        x
                      </button>
                    )}
                  </span>
                ))}
                <span className="ml-auto hidden font-mono sm:block">j / k to move</span>
              </div>

              <div className={`space-y-3 transition-opacity ${search.isPlaceholderData ? "opacity-50" : ""}`}>
                {results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    terms={meta.terms}
                    selected={selected?.id === result.id}
                    onClick={() => open(result)}
                  />
                ))}
              </div>

              {results.length === 0 && !search.isFetching && (
                <div className="py-14 text-center text-sm text-mute">
                  No posts match. Try fewer filters or switch to Semantic mode.
                </div>
              )}

              {search.hasNextPage && (
                <button
                  type="button"
                  onClick={() => search.fetchNextPage()}
                  disabled={search.isFetchingNextPage}
                  className="mt-4 w-full rounded-xl border border-line bg-panel py-2.5 text-sm font-medium transition hover:border-accent disabled:opacity-60"
                >
                  {search.isFetchingNextPage ? "Loading" : "Load more results"}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className={`${
          showThread ? "fixed inset-0 z-30 bg-bg" : "hidden"
        } min-h-0 lg:static lg:z-auto lg:block`}
      >
        <ThreadPane
          selected={selected}
          onOpen={(id) => onSelect({ id })}
          onClose={() => setShowThread(false)}
        />
      </section>
    </div>
  );
}
