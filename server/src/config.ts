export function readServerConfig(env: NodeJS.ProcessEnv = process.env) {
  const portText = env.PORT ?? "8000";
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const entries = (env.ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (env.NODE_ENV === "production" && entries.length === 0) {
    throw new Error("ALLOWED_ORIGINS is required in production (comma-separated client origins).");
  }
  const origins: (string | RegExp)[] = entries.map(entry => {
    const url = new URL(entry);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || entry.includes("*")) {
      throw new Error("ALLOWED_ORIGINS must contain exact HTTP(S) origins, without paths or wildcards.");
    }
    return url.origin;
  });
  // Preserve convenient development/LAN access when no explicit list is supplied.
  if (origins.length === 0) origins.push(/.*/);
  return { port, origins };
}

export function isAllowedOrigin(origin: string | undefined, origins: (string | RegExp)[]) {
  // Non-browser clients and health checks may omit Origin. Credentials still authorize moves.
  return origin === undefined || origins.some(allowed =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin));
}
