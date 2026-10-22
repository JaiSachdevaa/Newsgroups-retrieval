export function Loading({ label = "Loading" }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center gap-3 text-sm text-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }) {
  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border border-line bg-panel p-5 text-sm">
      <p className="font-semibold">Could not load data</p>
      <p className="mt-1 text-mute">{message}</p>
      <p className="mt-3 font-mono text-xs text-mute">
        Is the API running on port 8000, and has build_index.py finished?
      </p>
    </div>
  );
}
