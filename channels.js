import { getChannels } from "../lib/playlist.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=300");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const channels = await getChannels();
    return res.status(200).json({ channels: channels.map(({ slug, name }) => ({ slug, name })) });
  } catch (error) {
    console.error("Rebel IPTV channel list failed:", error);
    return res.status(502).json({ error: "Unable to load the Rebel IPTV playlist right now." });
  }
};
