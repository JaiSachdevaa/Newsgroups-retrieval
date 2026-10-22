const BASE = import.meta.env.VITE_API_URL ?? "";

async function get(path, params) {
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      url.searchParams.set(key, String(value));
    }
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  search: (params) => get("/search", params),
  suggest: (q) => get("/suggest", { q }),
  groups: () => get("/groups"),
  thread: (id) => get(`/thread/${id}`),
  similar: (id) => get(`/similar/${id}`),
  topics: () => get("/topics"),
  stats: () => get("/stats"),
  evaluation: () => get("/eval"),
};
