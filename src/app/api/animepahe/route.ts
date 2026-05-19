import { NextResponse } from "next/server";
import { Animepahe } from "./animepahe";

export const revalidate = 60; // cache for 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  // Route: /api/animepahe?path=search&query=one+piece
  if (path === "search") {
    const query = searchParams.get("query");
    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }
    const results = await Animepahe.search(query);
    return NextResponse.json({ results }, { status: 200 });
  }

  // Route: /api/animepahe?path=latest
  if (path === "latest") {
    const results = await Animepahe.latest();
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
    const info = await Animepahe.info(id);
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
    const episodes = await Animepahe.fetchAllEpisodes(id);
    return NextResponse.json({ results: episodes }, { status: 200 });
  }

  // Route: /api/animepahe?path=episode&id=anime-id&session=episode-session
  if (path === "episode") {
    const id = searchParams.get("id");
    const session = searchParams.get("session");

    if (!id || !session) {
      return NextResponse.json(
        { error: "id and session parameters are required" },
        { status: 400 }
      );
    }

    const response = {
      animeId: id,
      episodeSession: session,
      sub: [] as any[],
      dub: [] as any[],
      totalStreams: 0,
    };

    for await (const result of Animepahe.streams(id, session)) {
      const stream = {
        id: result.id,
        title: result.title,
        m3u8Url: result.directUrl
          ? `https://valt-top-proxy.vercel.app/m3u8-proxy?url=${encodeURIComponent(result.directUrl)}`
          : null,
        downloadUrl: result.downloadUrl ?? null,
      };

      // 🎯 Detect audio type
      const audio = (result.audio || "").toLowerCase();

      if (audio.includes("eng")) {
        response.dub.push(stream);
      } else {
        response.sub.push(stream);
      }
    }

    response.totalStreams = response.sub.length + response.dub.length;

    return NextResponse.json(response, { status: 200 });
  }


  return NextResponse.json(
    { error: "Invalid path. Use: search, latest, info, episodes, or episode" },
    { status: 400 }
  );
}