import { getChannels } from "../lib/playlist.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const name = String(req.query.name || "").trim().toLowerCase();
  if (!name || !/^[a-z0-9_-]{1,80}$/.test(name)) {
    return res.status(400).json({ error: "Invalid channel name." });
  }

  try {
    const channels = await getChannels();
    const channel = channels.find((item) => item.slug === name);
    if (!channel) return res.status(404).json({ error: "Channel not found in the current Rebel IPTV playlist." });
    return res.status(200).json({ name: channel.name, slug: channel.slug, url: channel.url });
  } catch (error) {
    console.error("Rebel IPTV playlist lookup failed:", error);
    return res.status(502).json({ error: "Unable to load the Rebel IPTV playlist right now." });
  }
};
