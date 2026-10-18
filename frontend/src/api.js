const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export async function api(path, options = {}) {
  const token = sessionStorage.getItem("session");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers,
    body,
  });
  if (!response.ok) {
    let detail = "The request failed. Please try again.";
    try {
      const data = await response.json();
      detail =
        typeof data.detail === "string"
          ? data.detail
          : data.detail
              ?.map((x) => `${x.loc.slice(1).join(".")}: ${x.msg}`)
              .join("; ") || detail;
    } catch {
      /* preserve readable fallback */
    }
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  if (options.download) return response.blob();
  return response.json();
}
export const percent = (earned, maximum) =>
  maximum ? Math.round((earned / maximum) * 100) : 0;
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
