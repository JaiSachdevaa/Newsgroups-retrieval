import { MODE_BY_ID } from "../lib/modes.js";

function Source({ label, color, rank, score, scoreLabel, contribution, maxContribution, pool }) {
  const width = contribution && maxContribution ? (contribution / maxContribution) * 100 : 0;
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-mono text-xs text-mute">
          {rank ? `rank ${rank} of ${pool}` : `outside the top ${pool}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-mute">
        <span>
          {scoreLabel} {score == null ? "n/a" : score}
        </span>
        {contribution != null && <span>fusion share {contribution.toFixed(4)}</span>}
      </div>
    </div>
  );
}

export default function WhyPanel({ selected }) {
  const why = selected?.why;
  const mode = selected?.mode ?? "hybrid";
  const info = MODE_BY_ID[mode];

  if (!why || (why.bm25 == null && why.semantic == null)) {
    return (
      <p className="p-6 text-sm text-mute">
        Open this post from a search result to see how it was scored. Posts opened from the topic
        map or the similar list have no query to explain.
      </p>
    );
  }

  const k = why.rrf_k ?? 60;
  const pool = 200;
  const bm25Share = why.bm25_rank ? 1 / (k + why.bm25_rank) : 0;
  const semanticShare = why.semantic_rank ? 1 / (k + why.semantic_rank) : 0;
  const best = 1 / (k + 1);

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-lg border border-line bg-panel p-3 text-sm">
        <p className="font-medium">{info?.label} search</p>
        <p className="mt-1 text-mute">{info?.blurb}</p>
      </div>

      {why.bm25 != null && (
        <Source
          label="Keyword (BM25)"
          color="#6b8afd"
          rank={why.bm25_rank}
          score={why.bm25}
          scoreLabel="score"
          contribution={mode === "hybrid" ? bm25Share : null}
          maxContribution={best}
          pool={pool}
        />
      )}
      {why.semantic != null && (
        <Source
          label="Semantic (MiniLM)"
          color="#2dd4bf"
          rank={why.semantic_rank}
          score={why.semantic}
          scoreLabel="cosine"
          contribution={mode === "hybrid" ? semanticShare : null}
          maxContribution={best}
          pool={pool}
        />
      )}

      {mode === "hybrid" && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
          <p className="text-sm font-medium">Reciprocal Rank Fusion</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-mute">
            {bm25Share > 0 ? `1 / (${k} + ${why.bm25_rank})` : "0"}
            {" + "}
            {semanticShare > 0 ? `1 / (${k} + ${why.semantic_rank})` : "0"}
            {" = "}
            <span className="font-semibold text-ink">{(bm25Share + semanticShare).toFixed(4)}</span>
          </p>
          <p className="mt-2 text-xs text-mute">
            A post ranked high by both retrievers beats a post that only one of them likes. The
            constant {k} keeps a single first place from dominating.
          </p>
        </div>
      )}

      {selected?.reranked && (
        <p className="rounded-lg border border-line bg-panel p-3 text-xs text-mute">
          The final order was set by a cross-encoder reranker over the top 50, so it can differ
          from the scores above.
        </p>
      )}
    </div>
  );
}
