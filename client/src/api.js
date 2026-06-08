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
  signup: (name, email, password) =>
    request("POST", "/api/signup", { name, email, password }),
  login: (email, password) => request("POST", "/api/login", { email, password }),
  logout: () => request("POST", "/api/logout"),
  changePassword: (currentPassword, newPassword) =>
    request("POST", "/api/account/password", { currentPassword, newPassword }),
  deleteAccount: () => request("DELETE", "/api/account"),
  adminOverview: () => request("GET", "/api/admin/overview"),
  adminUsers: () => request("GET", "/api/admin/users"),
  adminResetPassword: (id) =>
    request("POST", `/api/admin/users/${id}/reset-password`),
  adminDeleteUser: (id) => request("DELETE", `/api/admin/users/${id}`),
  entries: (year) => request("GET", `/api/entries?year=${year}`),
  saveEntry: (date, mood, note, activities) =>
    request("PUT", `/api/entries/${date}`, { mood, note, activities }),
  stats: (year, month) =>
    request("GET", `/api/stats?year=${year}&month=${month}`),
};
