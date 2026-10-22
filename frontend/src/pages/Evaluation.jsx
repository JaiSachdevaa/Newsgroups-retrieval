import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { ErrorBox, Loading } from "../components/State.jsx";
import { groupColor } from "../lib/groups.js";
import { MODES } from "../lib/modes.js";

const METRICS = [
  { key: "p10", label: "P@10", hint: "Share of the top 10 results that are relevant" },
  { key: "map100", label: "MAP@100", hint: "Mean average precision over the top 100" },
  { key: "ndcg10", label: "nDCG@10", hint: "Rank discounted gain over the top 10" },
];

const tooltipStyle = {
  background: "var(--c-raised)",
  border: "1px solid var(--c-line)",
  borderRadius: 8,
  fontSize: 12,
};
const tick = { fill: "var(--c-mute)", fontSize: 11 };

export default function Evaluation() {
  const { data, isLoading, error } = useQuery({ queryKey: ["eval"], queryFn: api.evaluation });

  if (isLoading) return <Loading label="Loading evaluation" />;
  if (error || !data) return <ErrorBox message={error?.message ?? "No data"} />;

  const chartData = METRICS.map((metric) => ({
    metric: metric.label,
    ...Object.fromEntries(MODES.map((mode) => [mode.id, data.modes[mode.id][metric.key]])),
  }));

  const best = (key) =>
    MODES.reduce((winner, mode) =>
      data.modes[mode.id][key] > data.modes[winner.id][key] ? mode : winner
    ).id;

  const groups = Object.keys(data.by_group).sort();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold">Retrieval evaluation</h1>
          <p className="mt-1 max-w-3xl text-sm text-mute">{data.protocol}</p>
          <p className="mt-1 font-mono text-xs text-mute">
            {data.num_queries} queries, depth {data.depth}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((mode) => (
            <div key={mode.id} className="rounded-2xl border border-line bg-panel p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: mode.color }} />
                {mode.label}
              </p>
              <dl className="mt-4 space-y-2">
                {METRICS.map((metric) => (
                  <div key={metric.key} className="flex items-baseline justify-between" title={metric.hint}>
                    <dt className="text-xs text-mute">{metric.label}</dt>
                    <dd
                      className={`font-mono text-lg tabular-nums ${
                        best(metric.key) === mode.id ? "font-semibold text-accent" : ""
                      }`}
                    >
                      {data.modes[mode.id][metric.key].toFixed(3)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between border-t border-line pt-2">
                  <dt className="text-xs text-mute">Mean latency</dt>
                  <dd className="font-mono text-sm tabular-nums">
                    {data.modes[mode.id].latency_ms.toFixed(1)} ms
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">Metrics by retrieval mode</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--c-line)" />
              <XAxis dataKey="metric" tick={tick} stroke="var(--c-line)" />
              <YAxis domain={[0, 1]} tick={tick} stroke="var(--c-line)" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--c-line)", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {MODES.map((mode) => (
                <Bar
                  key={mode.id}
                  dataKey={mode.id}
                  name={mode.label}
                  fill={mode.color}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-1 text-sm font-semibold">P@10 by newsgroup</h2>
          <p className="mb-4 text-xs text-mute">
            Which topics each retriever handles well. Darker cells mean more relevant results in the
            top 10.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th className="pb-2 font-medium">Newsgroup</th>
                  {MODES.map((mode) => (
                    <th key={mode.id} className="pb-2 text-center font-medium">
                      {mode.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group} className="border-t border-line">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2 font-mono text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: groupColor(group) }} />
                        {group}
                      </span>
                    </td>
                    {MODES.map((mode) => {
                      const value = data.by_group[group][mode.id];
                      return (
                        <td key={mode.id} className="p-1 text-center">
                          <span
                            className="block rounded-md py-1 font-mono text-xs tabular-nums"
                            style={{
                              background: `color-mix(in oklab, var(--c-accent) ${Math.round(value * 70)}%, transparent)`,
                            }}
                          >
                            {value.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
