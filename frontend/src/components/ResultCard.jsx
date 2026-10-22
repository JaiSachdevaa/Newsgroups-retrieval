import GroupBadge from "./GroupBadge.jsx";
import Highlight from "./Highlight.jsx";

export default function ResultCard({ result, terms, selected, onClick }) {
  return (
    <article
      id={`result-${result.id}`}
      onClick={onClick}
      className={`rise cursor-pointer rounded-xl border p-3.5 transition ${
        selected
          ? "border-accent bg-raised shadow-sm"
          : "border-line bg-panel hover:border-mute/40 hover:bg-raised"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <GroupBadge group={result.group} />
        <span className="font-mono text-mute">#{result.number}</span>
        {result.thread_size > 1 && (
          <span className="ml-auto rounded bg-line/70 px-1.5 py-0.5 font-mono text-mute">
            {result.thread_size} in thread
          </span>
        )}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug">
        <Highlight text={result.subject} terms={terms} />
      </h3>
      <p className="mt-0.5 truncate text-xs text-mute">
        {result.author}
        {result.organization ? ` · ${result.organization}` : ""}
      </p>
      {result.snippet && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink/80">
          <Highlight text={result.snippet} terms={terms} />
        </p>
      )}
      {result.relevance != null && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round(result.relevance * 100)}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-mute">{result.score.toFixed(3)}</span>
        </div>
      )}
    </article>
  );
}
