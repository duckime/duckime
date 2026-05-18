import { NextResponse } from "next/server";
import { Animepahe } from "../animepahe";

export const revalidate = 60; // cache for 60 seconds

/**
 * Map an Anilist ID to an Animepahe session ID
 * This function queries the Anilist API to get the anime title,
 * then searches Animepahe for a matching anime
 */
async function mapAnilistToAnimepahe(anilistId: string): Promise<string | null> {
    try {
        // Query Anilist API for the anime title
        const anilistQuery = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    title {
                        romaji
                        english
                        native
                    }
                    synonyms
                }
            }
        `;

        const anilistResponse = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                query: anilistQuery,
                variables: { id: parseInt(anilistId) },
            }),
        });

        const anilistData = await anilistResponse.json();
        if (!anilistData?.data?.Media) {
            console.error(`No anime found on Anilist for ID: ${anilistId}`);
            return null;
        }

        const titles = anilistData.data.Media.title;
        const titlesToSearch = [
            titles.romaji,
            titles.english,
            titles.native,
            ...(anilistData.data.Media.synonyms || []),
        ].filter(Boolean);

        // Search Animepahe for each title variant
        for (const title of titlesToSearch) {
            if (!title) continue;

            const searchResults = await Animepahe.search(title as string);
            if (searchResults.length === 0) continue;

            // Check each search result to find a match
            for (const result of searchResults) {
                // Get the anime page to check external links for Anilist match
                const info = await Animepahe.info(result.session);
                if (!info) continue;

                // Check if any external link contains the Anilist ID
                const hasMatchingLink = info.externalLinks.some(link =>
                    link.includes(`anilist.co/anime/${anilistId}`) ||
                    link.includes(`myanimelist.net/anime/${anilistId}`)
                );

                if (hasMatchingLink) {
                    return result.session;
                }

                // Also check if titles match closely
                const animepaheTitle = info.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                const searchTitle = (title as string).toLowerCase().replace(/[^a-z0-9]/g, "");
                if (animepaheTitle === searchTitle || animepaheTitle.includes(searchTitle)) {
                    return result.session;
                }
            }
        }

        console.error(`No matching Animepahe anime found for Anilist ID: ${anilistId}`);
        return null;
    } catch (error) {
        console.error(`Error mapping Anilist ID ${anilistId}:`, error);
        return null;
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ anilistId: string }> }
) {
    const { anilistId } = await params;

    if (!anilistId) {
        return NextResponse.json(
            { error: "anilistId parameter is required" },
            { status: 400 }
        );
    }

    // Map Anilist ID to Animepahe session ID
    const animepaheSession = await mapAnilistToAnimepahe(anilistId);

    if (!animepaheSession) {
        return NextResponse.json(
            { error: "Anime not found on Animepahe for this Anilist ID" },
            { status: 404 }
        );
    }

    // Get anime info and episodes in parallel
    const [info, episodes] = await Promise.all([
        Animepahe.info(animepaheSession),
        Animepahe.fetchAllEpisodes(animepaheSession),
    ]);

    if (!info) {
        return NextResponse.json(
            { error: "Anime not found" },
            { status: 404 }
        );
    }
    const episodesWithId = episodes.map((ep: any) => ({
        ...ep,
        episodeId: `${animepaheSession}&session=${ep.session}`
    }));

    return NextResponse.json(
        {
            info,
            episodes: episodesWithId,
            anilistId,
            animepaheSession,
        },
        { status: 200 }
    );
}
