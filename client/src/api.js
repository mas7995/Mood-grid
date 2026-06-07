// Thin fetch wrapper. All requests are same-origin and send the session cookie.
async function request(method, url, body) {
  const opts = {
    method,
    credentials: "same-origin",
    headers: {},
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request("GET", "/api/me"),
  listProfiles: () => request("GET", "/api/profiles"),
  createProfile: (name, pin) => request("POST", "/api/profiles", { name, pin }),
  login: (name, pin) => request("POST", "/api/login", { name, pin }),
  logout: () => request("POST", "/api/logout"),
  entries: (year) => request("GET", `/api/entries?year=${year}`),
  saveEntry: (date, mood, note, activities) =>
    request("PUT", `/api/entries/${date}`, { mood, note, activities }),
  stats: (year, month) =>
    request("GET", `/api/stats?year=${year}&month=${month}`),
};
