import { NextResponse } from "next/server";
import { ConsumetAPI } from "@/lib/consumet";

export const revalidate = 60; // cache for 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Search anime
  if (action === "search") {
    const query = searchParams.get("query");
    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }
    const results = await ConsumetAPI.search(query);
    return NextResponse.json({ results }, { status: 200 });
  }

  // Get anime info
  if (action === "info") {
    const animeId = searchParams.get("animeId");
    if (!animeId) {
      return NextResponse.json(
        { error: "animeId parameter is required" },
        { status: 400 }
      );
    }
    const info = await ConsumetAPI.getInfo(animeId);
    if (!info) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }
    return NextResponse.json(info, { status: 200 });
  }

  // Get episodes
  if (action === "episodes") {
    const animeId = searchParams.get("animeId");
    if (!animeId) {
      return NextResponse.json(
        { error: "animeId parameter is required" },
        { status: 400 }
      );
    }
    const episodes = await ConsumetAPI.getEpisodes(animeId);
    return NextResponse.json({ episodes }, { status: 200 });
  }

  // Get streaming links for an episode
  if (action === "watch") {
    const animeId = searchParams.get("animeId");
    const episodeNumber = searchParams.get("episode");

    if (!animeId || !episodeNumber) {
      return NextResponse.json(
        { error: "animeId and episode parameters are required" },
        { status: 400 }
      );
    }

    try {
      const streams = await ConsumetAPI.getStreams(
        animeId,
        parseInt(episodeNumber, 10)
      );

      const episodeNum = parseInt(episodeNumber, 10);
      if (!streams || streams.length === 0) {
        console.log(`[Consumet] No streams found for anime ${animeId} episode ${episodeNum}`);
        return NextResponse.json(
          {
            animeId,
            episode: episodeNum,
            sources: [],
            error: "No streams found - try another episode or anime",
          },
          { status: 200 }
        );
      }

      // Wrap M3U8 URLs through our proxy to avoid CORS
      const wrappedStreams = streams.map((stream) => ({
        ...stream,
        url: stream.isM3u8
          ? `/api/proxy?url=${encodeURIComponent(stream.url)}`
          : stream.url,
      }));

      return NextResponse.json(
        {
          animeId,
          episode: parseInt(episodeNumber, 10),
          streams: wrappedStreams,
          totalStreams: wrappedStreams.length,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Watch route error:", error);
      return NextResponse.json(
        { error: "Failed to fetch streams", details: String(error) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid action. Use: search, info, episodes, or watch" },
    { status: 400 }
  );
}
