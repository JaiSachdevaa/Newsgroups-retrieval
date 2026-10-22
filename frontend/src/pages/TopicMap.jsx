import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { api } from "../api.js";
import { ErrorBox, Loading } from "../components/State.jsx";
import { GROUPS, groupColor } from "../lib/groups.js";

function PointTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-line bg-raised p-2.5 text-xs shadow-lg">
      <p className="font-medium leading-snug">{point.subject}</p>
      <p className="mt-1 font-mono text-mute">{point.group}</p>
      <p className="mt-1 text-mute">Click to open the thread</p>
    </div>
  );
}

export default function TopicMap({ onOpen }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["topics"], queryFn: api.topics });
  const [hidden, setHidden] = useState(new Set());

  const byGroup = useMemo(() => {
    const grouped = {};
    (data?.points ?? []).forEach((point) => {
      grouped[point.group] = grouped[point.group] ?? [];
      grouped[point.group].push(point);
    });
    return grouped;
  }, [data]);

  if (isLoading) return <Loading label="Loading topic map" />;
  if (error || !data) return <ErrorBox message={error?.message ?? "No data"} />;

  const toggle = (group) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Topic map</h1>
          <p className="mt-1 max-w-2xl text-sm text-mute">
            {data.sampled.toLocaleString()} of {data.total.toLocaleString()} posts, projected to two
            dimensions from their MiniLM embeddings with {data.method}. Posts about the same thing
            land close together, so each newsgroup forms a visible island.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHidden(new Set())}
            className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-accent"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={() => setHidden(new Set(GROUPS))}
            className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-accent"
          >
            Hide all
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {GROUPS.map((group) => {
          const off = hidden.has(group);
          return (
            <button
              key={group}
              type="button"
              onClick={() => toggle(group)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                off ? "border-line text-mute opacity-50" : "border-line bg-panel"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: groupColor(group) }} />
              {group}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-0 flex-1 rounded-2xl border border-line bg-panel p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis type="number" dataKey="x" hide domain={[-0.02, 1.02]} />
            <YAxis type="number" dataKey="y" hide domain={[-0.02, 1.02]} />
            <ZAxis range={[26, 26]} />
            <Tooltip content={<PointTip />} cursor={{ strokeDasharray: "3 3" }} />
            {GROUPS.map((group) => (
              <Scatter
                key={group}
                name={group}
                data={hidden.has(group) ? [] : byGroup[group] ?? []}
                fill={groupColor(group)}
                fillOpacity={0.8}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(point) => {
                  const id = point?.payload?.id ?? point?.id;
                  if (id != null) onOpen(id);
                }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
