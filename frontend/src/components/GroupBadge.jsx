import { groupColor } from "../lib/groups.js";

export default function GroupBadge({ group }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-mono text-[11px]">
      <span className="h-2 w-2 rounded-full" style={{ background: groupColor(group) }} />
      {group}
    </span>
  );
}
