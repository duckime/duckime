import { NextResponse } from "next/server";
import { ConsumetAPI } from "@/lib/consumet";

export const revalidate = 60; // cache for 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  console.log(`[Consumet API] Request: path=${path}`);

  // Route: /api/animepahe?path=search&query=one+piece
  if (path === "search") {
    const query = searchParams.get("query");
    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }
    console.log(`[Consumet API] Searching: ${query}`);
    const results = await ConsumetAPI.search(query);
    return NextResponse.json({ results }, { status: 200 });
  }

  // Route: /api/animepahe?path=latest
  if (path === "latest") {
    console.log(`[Consumet API] Getting latest`);
    const results = await ConsumetAPI.search("trending");
    return NextResponse.json({ results }, { status: 200 });
  }

  // Route: /api/animepahe?path=info&id=anime-id
  if (path === "info") {
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }
    console.log(`[Consumet API] Getting info for: ${id}`);
    const info = await ConsumetAPI.getInfo(id);
    if (!info) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }
    return NextResponse.json(info, { status: 200 });
  }

  // Route: /api/animepahe?path=episodes&id=anime-id
  if (path === "episodes") {
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }
    console.log(`[Consumet API] Getting episodes for: ${id}`);
    const episodes = await ConsumetAPI.getEpisodes(id);
    
    // Format to match old format
    const results = episodes.map((ep, idx) => ({
      episode: ep.number || idx + 1,
      session: ep.id,
      snapshot: ep.image || "",
      duration: 0,
      filler: ep.filler || false,
    }));
    
    return NextResponse.json({ results }, { status: 200 });
  }

  // Route: /api/animepahe?path=episode&id=anime-id&session=episode-number
  if (path === "episode") {
    const id = searchParams.get("id");
    const session = searchParams.get("session");

    if (!id || !session) {
      return NextResponse.json(
        { error: "id and session parameters are required" },
        { status: 400 }
      );
    }

    const episodeNumber = parseInt(session, 10);
    console.log(`[Consumet API] Getting streams for: ${id} episode ${episodeNumber}`);

    try {
      const streams = await ConsumetAPI.getStreams(id, episodeNumber);

      const response = {
        animeId: id,
        episodeSession: session,
        sub: [] as any[],
        dub: [] as any[],
        totalStreams: 0,
      };

      if (!streams || streams.length === 0) {
        console.log(`[Consumet API] No streams found for ${id} ep ${episodeNumber}`);
        return NextResponse.json(response, { status: 200 });
      }

      // Format streams
      streams.forEach((stream, idx) => {
        const streamObj = {
          id: `${id}-${idx}`,
          title: `Stream ${idx + 1}`,
          m3u8Url: stream.isM3u8
            ? `/api/proxy?url=${encodeURIComponent(stream.url)}`
            : stream.url,
          downloadUrl: stream.url,
          quality: stream.quality || "unknown",
        };

        // Default to sub (we don't have audio language info from Consumet)
        response.sub.push(streamObj);
      });

      response.totalStreams = response.sub.length + response.dub.length;
      
      console.log(`[Consumet API] Found ${response.totalStreams} streams for ${id} ep ${episodeNumber}`);
      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error("[Consumet API] Episode route error:", error);
      return NextResponse.json(
        {
          animeId: id,
          episodeSession: session,
          sub: [],
          dub: [],
          totalStreams: 0,
          error: "Failed to fetch streams",
        },
        { status: 200 }
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid path. Use: search, latest, info, episodes, or episode" },
    { status: 400 }
  );
}
