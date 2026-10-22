import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { categoryColor, categoryOf, groupColor } from "../lib/groups.js";

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function Node({ node, depth, activeGroup, onSelect, expanded, toggle }) {
  const hasChildren = node.children.length > 0;
  const open = expanded.has(node.path);
  const active = activeGroup === node.path;
  const dotColor = hasChildren ? categoryColor(categoryOf(node.path)) : groupColor(node.path);

  return (
    <li>
      <div
        className={`flex items-center rounded-md pr-2 text-sm ${
          active ? "bg-accent/15" : "hover:bg-raised"
        }`}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && toggle(node.path)}
          className="flex h-7 w-5 items-center justify-center text-mute"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            <Chevron open={open} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(active ? "" : node.path)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left"
        >
          <span
            className={`truncate font-mono text-[12.5px] ${active ? "font-semibold" : ""}`}
            title={node.path}
          >
            {node.name}
          </span>
          <span className="font-mono text-[11px] text-mute">{node.count.toLocaleString()}</span>
        </button>
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <Node
              key={child.path}
              node={child}
              depth={depth + 1}
              activeGroup={activeGroup}
              onSelect={onSelect}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function GroupTree({ activeGroup, onSelect }) {
  const { data, isLoading } = useQuery({ queryKey: ["groups"], queryFn: api.groups });
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    if (data?.tree) {
      setExpanded(new Set(data.tree.map((node) => node.path)));
    }
  }, [data]);

  const toggle = (path) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const total = data?.tree?.reduce((sum, node) => sum + node.count, 0) ?? 0;

  return (
    <nav className="p-3" aria-label="Newsgroups">
      <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-mute">
        Newsgroups
      </p>
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
          activeGroup === "" ? "bg-accent/15 font-semibold" : "hover:bg-raised"
        }`}
      >
        <span>All groups</span>
        <span className="font-mono text-[11px] text-mute">{total.toLocaleString()}</span>
      </button>
      {isLoading && <p className="px-2 py-3 text-xs text-mute">Loading groups</p>}
      <ul>
        {data?.tree?.map((node) => (
          <Node
            key={node.path}
            node={node}
            depth={0}
            activeGroup={activeGroup}
            onSelect={onSelect}
            expanded={expanded}
            toggle={toggle}
          />
        ))}
      </ul>
    </nav>
  );
}
