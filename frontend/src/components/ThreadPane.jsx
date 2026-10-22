import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import GroupBadge from "./GroupBadge.jsx";
import Highlight from "./Highlight.jsx";
import ResultCard from "./ResultCard.jsx";
import WhyPanel from "./WhyPanel.jsx";
import { Loading } from "./State.jsx";

const TABS = [
  { id: "thread", label: "Thread" },
  { id: "similar", label: "Similar posts" },
  { id: "why", label: "Why this ranked" },
];

function PostBody({ text, terms }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 1400;
  const shown = long && !open ? `${text.slice(0, 1400)}...` : text;
  return (
    <div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink/90">
        <Highlight text={shown} terms={terms} />
      </pre>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-2 text-xs font-medium text-accent hover:underline"
        >
          {open ? "Show less" : "Show full post"}
        </button>
      )}
    </div>
  );
}

function Post({ post, index, current, terms }) {
  return (
    <li
      id={`post-${post.id}`}
      className={`rise rounded-xl border p-4 ${
        current ? "border-accent bg-raised" : "border-line bg-panel"
      }`}
      style={{ marginLeft: index === 0 ? 0 : 16 }}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {(post.author || "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{post.author}</p>
          <p className="truncate text-xs text-mute">{post.organization || "No organization"}</p>
        </div>
        <div className="text-right">
          <span className="rounded bg-line/70 px-1.5 py-0.5 font-mono text-[11px] text-mute">
            {index === 0 ? "original" : "reply"}
          </span>
          <p className="mt-1 font-mono text-[11px] text-mute">#{post.number}</p>
        </div>
      </div>
      {post.body ? (
        <PostBody text={post.body} terms={terms} />
      ) : (
        <p className="text-sm italic text-mute">This post has no body.</p>
      )}
      {post.truncated && (
        <p className="mt-2 text-xs text-mute">Long post, shortened to 8,000 characters.</p>
      )}
    </li>
  );
}

export default function ThreadPane({ selected, onOpen, onClose }) {
  const [tab, setTab] = useState("thread");
  const id = selected?.id;

  const thread = useQuery({
    queryKey: ["thread", id],
    queryFn: () => api.thread(id),
    enabled: id != null,
  });
  const similar = useQuery({
    queryKey: ["similar", id],
    queryFn: () => api.similar(id),
    enabled: id != null && tab === "similar",
  });

  useEffect(() => {
    if (tab === "thread" && thread.data) {
      document.getElementById(`post-${id}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [thread.data, tab, id]);

  if (id == null) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-line px-2 py-1 text-xs lg:hidden"
        >
          Close
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 font-mono text-lg text-accent">
          &gt;_
        </div>
        <p className="mt-4 text-sm font-medium">No post selected</p>
        <p className="mt-1 max-w-xs text-xs text-mute">
          Pick a result to read the whole thread, find similar posts and see why it ranked.
        </p>
      </div>
    );
  }

  const data = thread.data;
  const terms = selected.terms ?? [];

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="border-b border-line bg-panel px-5 pb-0 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {data && <GroupBadge group={data.group} />}
              {data && (
                <span className="font-mono text-[11px] text-mute">
                  {data.count} {data.count === 1 ? "post" : "posts"}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug">
              {data ? data.subject : "Loading thread"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-2 py-1 text-xs text-mute lg:hidden"
          >
            Back
          </button>
        </div>
        <div role="tablist" className="mt-3 flex gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition ${
                tab === item.id
                  ? "border-accent text-ink"
                  : "border-transparent text-mute hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "thread" && (
          <div className="p-4">
            {thread.isLoading && <Loading label="Loading thread" />}
            {thread.error && <p className="p-4 text-sm text-mute">{thread.error.message}</p>}
            {data && (
              <>
                {data.count > 1 && (
                  <p className="mb-3 text-xs text-mute">
                    Replies are grouped by subject within the newsgroup and shown oldest first.
                  </p>
                )}
                <ul className="space-y-3">
                  {data.posts.map((post, index) => (
                    <Post
                      key={post.id}
                      post={post}
                      index={index}
                      current={post.id === id}
                      terms={terms}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === "similar" && (
          <div className="space-y-3 p-4">
            <p className="text-xs text-mute">
              Nearest neighbours by embedding, taken from other threads.
            </p>
            {similar.isLoading && <Loading label="Finding similar posts" />}
            {similar.data?.results.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                terms={[]}
                selected={false}
                onClick={() => {
                  onOpen(result.id);
                  setTab("thread");
                }}
              />
            ))}
          </div>
        )}

        {tab === "why" && <WhyPanel selected={selected} />}
      </div>
    </div>
  );
}
