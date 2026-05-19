import { NextResponse } from "next/server";
import { ConsumetAPI } from "./consumet";

export const revalidate = 60;

// Try the original AnimePahe API route for backwards compatibility
async function tryAnimePaheRoute(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    // Only handle search and info with Consumet, keep episodes working
    if (path === "search") {
      const query = searchParams.get("query");
      if (!query) return null;
      
      console.log(`[API] Search: ${query}`);
      const results = await ConsumetAPI.search(query);
      return NextResponse.json({ results }, { status: 200 });
    }

    if (path === "info") {
      const id = searchParams.get("id");
      if (!id) return null;
      
      console.log(`[API] Info for ID: ${id}`);
      const info = await ConsumetAPI.getInfo(id);
      if (!info) return NextResponse.json({ error: "Not found" }, { status: 404 });
      
      return NextResponse.json(info, { status: 200 });
    }

    if (path === "episodes") {
      const id = searchParams.get("id");
      if (!id) return null;
      
      console.log(`[API] Episodes for ID: ${id}`);
      const episodes = await ConsumetAPI.getEpisodes(id);
      
      // Return in format compatible with frontend
      return NextResponse.json({ 
        results: episodes.map((ep, idx) => ({
          episode: ep.number || idx + 1,
          session: ep.id,
          snapshot: ep.image || "",
          duration: 0,
          filler: ep.filler || false,
        }))
      }, { status: 200 });
    }

    return null;
  } catch (error) {
    console.error("[API] AnimePahe compatibility error:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // Try the compatibility route first
    const result = await tryAnimePaheRoute(request);
    if (result) return result;

    // Default error
    return NextResponse.json(
      { error: "Invalid parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
