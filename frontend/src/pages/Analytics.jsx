import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { ErrorBox, Loading } from "../components/State.jsx";
import { groupColor } from "../lib/groups.js";

const tooltipStyle = {
  background: "var(--c-raised)",
  border: "1px solid var(--c-line)",
  borderRadius: 8,
  fontSize: 12,
};
const tick = { fill: "var(--c-mute)", fontSize: 11 };

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function Analytics() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  if (isLoading) return <Loading label="Loading analytics" />;
  if (error || !data) return <ErrorBox message={error?.message ?? "No data"} />;

  const perGroup = data.groups.map((group) => ({ name: group.name, count: group.count }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold">Corpus analytics</h1>
          <p className="mt-1 text-sm text-mute">What the index is made of.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Posts" value={data.total_posts.toLocaleString()} />
          <Stat label="Threads" value={data.total_threads.toLocaleString()} />
          <Stat label="Distinct authors" value={data.total_authors.toLocaleString()} />
          <Stat label="Average words per post" value={Math.round(data.avg_words).toLocaleString()} />
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Panel title="Posts per newsgroup">
              <ResponsiveContainer width="100%" height={560}>
                <BarChart data={perGroup} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="var(--c-line)" />
                  <XAxis type="number" tick={tick} stroke="var(--c-line)" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    interval={0}
                    tick={{ ...tick, fontFamily: "JetBrains Mono, monospace" }}
                    stroke="var(--c-line)"
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--c-line)", opacity: 0.4 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {perGroup.map((entry) => (
                      <Cell key={entry.name} fill={groupColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <Panel title="Post length in words">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.length_histogram}>
                  <CartesianGrid vertical={false} stroke="var(--c-line)" />
                  <XAxis dataKey="bin" tick={tick} stroke="var(--c-line)" />
                  <YAxis tick={tick} stroke="var(--c-line)" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--c-line)", opacity: 0.4 }} />
                  <Bar dataKey="count" fill="var(--c-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Most active authors">
              <ol className="space-y-2">
                {data.top_authors.map((author, index) => (
                  <li key={`${author.name}-${index}`} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-mono text-xs text-mute">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{author.name}</span>
                    <span className="font-mono text-xs text-mute">{author.count}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>

        <Panel title="Defining terms per newsgroup">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.groups.map((group) => (
              <div key={group.name} className="rounded-xl border border-line bg-raised p-3">
                <p className="flex items-center gap-2 font-mono text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: groupColor(group.name) }} />
                  {group.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.top_terms.map((term) => (
                    <span key={term} className="rounded-md bg-line/70 px-1.5 py-0.5 text-xs">
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
