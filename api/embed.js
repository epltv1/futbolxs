import { URL } from "node:url";

function getAllowedDomains() {
  return String(process.env.EMBED_ALLOWED_DOMAINS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(
          entry.includes("://") ? entry : `https://${entry}`
        ).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

function forbidden(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(403).send("Embed not authorized for this domain.");
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed.");
  }

  const allowedDomains = getAllowedDomains();

  if (!allowedDomains.length) {
    return res.status(503).send("Embed allowlist is not configured.");
  }

  const referer = req.headers.referer || "";
  const fetchDestination = req.headers["sec-fetch-dest"];

  let parentHost;

  try {
    parentHost = new URL(referer).hostname.toLowerCase();
  } catch {
    return forbidden(res);
  }

  if (!allowedDomains.includes(parentHost)) {
    return forbidden(res);
  }

  if (fetchDestination && fetchDestination !== "iframe") {
    return forbidden(res);
  }

  const channel = String(req.query.channel || "").trim().toLowerCase();

  if (!/^[a-z0-9_-]{1,80}$/.test(channel)) {
    return res.status(400).send("Invalid channel name.");
  }

  const frameAncestors = [
    "'self'",
    ...allowedDomains.map((domain) => `https://${domain}`)
  ].join(" ");

  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "script-src 'unsafe-inline'",
      "frame-src 'self'",
      `frame-ancestors ${frameAncestors}`,
      "base-uri 'none'",
      "form-action 'none'"
    ].join("; ")
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const playerUrl = `/?channel=${encodeURIComponent(channel)}`;

  return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FutbolX Player</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #000;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
    #blocked {
      display: none;
      color: #fff;
      font: 16px Arial, sans-serif;
      text-align: center;
      padding: 24px;
    }
  </style>
</head>
<body>
  <div id="blocked">This premium embed must be opened inside an approved website.</div>
  <iframe id="player" title="FutbolX Player" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
  <script>
    if (window.top === window.self) {
      document.getElementById("player").remove();
      document.getElementById("blocked").style.display = "block";
    } else {
      document.getElementById("player").src = ${JSON.stringify(playerUrl)};
    }
  </script>
</body>
</html>`);
}
