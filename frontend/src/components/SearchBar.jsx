import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import useDebounced from "../hooks/useDebounced.js";
import { MODES } from "../lib/modes.js";

const OPERATORS = [
  { token: "group:", hint: "Limit to a group or category, for example group:sci" },
  { token: "from:", hint: "Match the author, for example from:mathew" },
  { token: '""', hint: "Require an exact phrase" },
];

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  mode,
  onMode,
  rerank,
  onRerank,
  inputRef,
}) {
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const debounced = useDebounced(value, 150);

  const suggest = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.suggest(debounced),
    enabled: focused && debounced.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
  const items = focused && suggest.data ? suggest.data.suggestions : [];

  const pick = (item) => {
    onChange(item.value);
    setCursor(-1);
    if (item.type === "subject") {
      onSubmit(item.value);
      inputRef.current?.blur();
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[cursor];
      if (item) {
        pick(item);
      } else {
        onSubmit(value);
        event.currentTarget.blur();
      }
    }
  };

  const insert = (token) => {
    const spacer = value && !value.endsWith(" ") ? " " : "";
    const next = `${value}${spacer}${token}`;
    onChange(next);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const position = token === '""' ? next.length - 1 : next.length;
      input.setSelectionRange(position, position);
    });
  };

  return (
    <div className="border-b border-line bg-panel px-4 pb-3 pt-4">
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4 4" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setCursor(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={'Search posts, for example "clipper chip" group:sci.crypt'}
          spellCheck={false}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-line bg-raised pl-10 pr-20 text-sm outline-none transition placeholder:text-mute focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                onSubmit("");
                inputRef.current?.focus();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-mute hover:bg-line"
              aria-label="Clear search"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-mute sm:block">
            /
          </kbd>
        </div>
        {items.length > 0 && (
          <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-raised shadow-lg">
            {items.map((item, index) => (
              <li key={`${item.type}-${item.label}`}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(item);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    index === cursor ? "bg-accent/15" : "hover:bg-bg"
                  }`}
                >
                  <span className="rounded bg-line px-1.5 py-0.5 font-mono text-[10px] uppercase text-mute">
                    {item.type === "group" ? "group" : "post"}
                  </span>
                  <span className={`truncate ${item.type === "group" ? "font-mono text-[12.5px]" : ""}`}>
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="tablist" className="inline-flex rounded-lg border border-line bg-bg p-0.5">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              onClick={() => onMode(item.id)}
              title={item.blurb}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                mode === item.id ? "bg-raised text-ink shadow-sm" : "text-mute hover:text-ink"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onRerank(!rerank)}
          aria-pressed={rerank}
          title="Rescore the top 50 with a cross-encoder. Downloads a model on first use."
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
            rerank ? "border-accent bg-accent/15 text-ink" : "border-line text-mute hover:text-ink"
          }`}
        >
          Rerank top 50
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          {OPERATORS.map((operator) => (
            <button
              key={operator.token}
              type="button"
              onClick={() => insert(operator.token)}
              title={operator.hint}
              className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-mute transition hover:border-accent hover:text-ink"
            >
              {operator.token}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
