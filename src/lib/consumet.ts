// Consumet API wrapper for reliable anime streaming
// This uses the public Consumet API with fallback sources

const CONSUMET_BASE = "https://api.consumet.org";

export interface ConsumetAnime {
  id: string;
  title: string;
  image?: string;
  cover?: string;
  episodes?: number;
}

export interface ConsumetEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  filler?: boolean;
}

export interface ConsumetStream {
  url: string;
  quality?: string;
  isM3u8?: boolean;
  headers?: Record<string, string>;
}

export class ConsumetAPI {
  // Search anime
  static async search(query: string): Promise<ConsumetAnime[]> {
    try {
      const res = await fetch(
        `${CONSUMET_BASE}/meta/anilist?query=${encodeURIComponent(query)}&type=ANIME`
      );
      const data = await res.json() as any;
      
      return (data.results || []).map((item: any) => ({
        id: item.id,
        title: item.title?.english || item.title?.romaji || item.title,
        image: item.image,
        cover: item.cover,
        episodes: item.totalEpisodes,
      }));
    } catch (error) {
      console.error("Consumet search error:", error);
      return [];
    }
  }

  // Get anime episodes
  static async getEpisodes(animeId: string): Promise<ConsumetEpisode[]> {
    try {
      const res = await fetch(
        `${CONSUMET_BASE}/meta/anilist/episodes/${animeId}`
      );
      const data = await res.json() as any;
      
      return (data || []).map((ep: any, idx: number) => ({
        id: ep.id || `ep-${idx + 1}`,
        number: ep.number || idx + 1,
        title: ep.title,
        image: ep.image,
        filler: ep.isFiller,
      }));
    } catch (error) {
      console.error("Consumet episodes error:", error);
      return [];
    }
  }

  // Get streaming links for an episode
  static async getStreams(animeId: string, episodeNumber: number): Promise<ConsumetStream[]> {
    try {
      // Try multiple providers with fallback
      const providers = ["gogoanime", "zoro", "animefox"];
      
      for (const provider of providers) {
        try {
          console.log(`Trying provider: ${provider}`);
          const res = await fetch(
            `${CONSUMET_BASE}/anime/${provider}/watch/${animeId}-episode-${episodeNumber}`,
            {
              signal: AbortSignal.timeout(8000),
            }
          );
          
          if (!res.ok) continue;
          
          const data = await res.json() as any;
          
          if (data.sources && data.sources.length > 0) {
            console.log(`✓ Got streams from ${provider}`);
            return data.sources.map((source: any) => ({
              url: source.url,
              quality: source.quality,
              isM3u8: source.isM3u8 || source.url?.includes("m3u8"),
              headers: source.headers,
            }));
          }
        } catch (err) {
          console.log(`Provider ${provider} failed, trying next...`, err);
          continue;
        }
      }
      
      // Final fallback: try Anilist meta provider
      console.log("Trying AniList metadata provider...");
      const episodeRes = await fetch(
        `${CONSUMET_BASE}/meta/anilist/watch/${animeId}-episode-${episodeNumber}`,
        {
          signal: AbortSignal.timeout(8000),
        }
      );
      
      if (episodeRes.ok) {
        const data = await episodeRes.json() as any;
        if (data.sources) {
          return data.sources.map((source: any) => ({
            url: source.url,
            quality: source.quality,
            isM3u8: source.isM3u8 || source.url?.includes("m3u8"),
            headers: source.headers,
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error("Consumet streams error:", error);
      return [];
    }
  }

  // Get anime info
  static async getInfo(animeId: string) {
    try {
      const res = await fetch(`${CONSUMET_BASE}/meta/anilist/${animeId}`);
      const data = await res.json() as any;
      
      return {
        id: data.id,
        title: data.title?.english || data.title?.romaji || data.title,
        description: data.description,
        image: data.image,
        cover: data.cover,
        episodes: data.totalEpisodes,
        status: data.status,
        rating: data.rating,
      };
    } catch (error) {
      console.error("Consumet info error:", error);
      return null;
    }
  }
}
