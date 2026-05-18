import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// 🔓 Base64 decode
function decodeBase64(str?: string) {
    try {
        if (!str) return null;
        return Buffer.from(str, "base64").toString("utf-8");
    } catch {
        return null;
    }
}

// --- string utils ---
function substringBefore(str: string, pattern: string): string {
    const idx = str.indexOf(pattern);
    return idx === -1 ? str : str.substring(0, idx);
}

function substringAfter(str: string, pattern: string): string {
    const idx = str.indexOf(pattern);
    return idx === -1 ? str : str.substring(idx + pattern.length);
}

function substringAfterLast(str: string, pattern: string): string {
    return str.split(pattern).pop() ?? "";
}

// --- JS Unpacker ---
class UnBase {
    private readonly radix: number;
    private readonly alpha62 =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private readonly alpha95 =
        ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    private alphabet = "";
    private dictionary: { [key: string]: number } = {};

    constructor(radix: number) {
        this.radix = radix;

        if (radix > 36) {
            if (radix < 62) this.alphabet = this.alpha62.substring(0, radix);
            else if (radix === 62) this.alphabet = this.alpha62;
            else if (radix < 95) this.alphabet = this.alpha95.substring(0, radix);
            else if (radix === 95) this.alphabet = this.alpha95;

            for (let i = 0; i < this.alphabet.length; i++) {
                this.dictionary[this.alphabet.charAt(i)] = i;
            }
        }
    }

    unBase(str: string): number {
        if (this.alphabet === "") {
            return parseInt(str, this.radix);
        }

        let ret = 0;

        for (let i = 0; i < str.length; i++) {
            const char = str.charAt(str.length - 1 - i);
            const value = this.dictionary[char];

            if (value !== undefined) {
                ret += Math.pow(this.radix, i) * value;
            }
        }

        return ret;
    }
}

class JSPacker {
    readonly packedJS: string;

    constructor(packedJS: string) {
        this.packedJS = packedJS;
    }

    detect(): boolean {
        return /eval\(function\(p,a,c,k,e,(?:r|d)/.test(
            this.packedJS.replace(/ /g, "")
        );
    }

    unpack(): string | null {
        try {
            const exp =
                /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;

            const matches = exp.exec(this.packedJS);
            if (!matches || matches.length !== 5) return null;

            let payload = matches[1]!.replace(/\\'/g, "'");
            const radix = parseInt(matches[2]!, 10) || 36;
            const count = parseInt(matches[3]!, 10) || 0;
            const symArray = matches[4]!.split("|");

            if (symArray.length !== count)
                throw new Error("Unknown p.a.c.k.e.r. encoding");

            const unBase = new UnBase(radix);

            payload = payload.replace(/\b\w+\b/g, (word: string): string => {
                const index = unBase.unBase(word);
                if (index < symArray.length && symArray[index])
                    return symArray[index];
                return word;
            });

            return payload;
        } catch {
            return null;
        }
    }
}

function unpackJsAndCombine(packedCode: string): string {
    const packer = new JSPacker(packedCode);

    if (packer.detect()) {
        const result = packer.unpack();
        if (result) return result;
    }

    throw new Error("Unable to unpack JS");
}

// --- Extract m3u8 ---
async function extractM3U8FromIframe(
    iframeUrl: string
): Promise<string | null> {
    try {
        const res = await fetch(iframeUrl, {
            headers: {
                "User-Agent": USER_AGENT,
                Referer: "https://kwik.cx/",
                Origin: "https://kwik.cx/",
            },
        });

        const body = await res.text();
        const $ = cheerio.load(body);

        let packedScript = "";

        $("script").each((_, el) => {
            const content = $(el).html() ?? "";
            if (content.includes("eval(function")) packedScript = content;
        });

        if (!packedScript) return null;

        const scriptPart = substringAfterLast(
            packedScript,
            "eval(function("
        );

        const unpacked = unpackJsAndCombine(
            "eval(function(" + scriptPart
        );

        const videoUrl = substringBefore(
            substringAfter(unpacked, "const source='"),
            "';"
        );

        return videoUrl?.startsWith("http") ? videoUrl : null;
    } catch {
        return null;
    }
}

// --- AniList → MAL ---
async function getMalId(anilistId: string) {
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        idMal
      }
    }
  `;

    const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query,
            variables: { id: Number(anilistId) },
        }),
        cache: "no-store",
    });

    const json = await res.json();
    return json?.data?.Media?.idMal;
}

// --- iframe fetch ---
async function getIframe(encoded?: string) {
    try {
        if (!encoded) return null;

        const res = await fetch(
            `https://animewave.to/ajax/server?get=${encoded}`,
            {
                headers: {
                    "User-Agent": USER_AGENT,
                    Referer: "https://animewave.to/",
                    "X-Requested-With": "XMLHttpRequest",
                },
            }
        );

        const data = await res.json();
        return data?.result?.url || null;
    } catch {
        return null;
    }
}

// 🎯 NEW FORMATTER
async function formatStreams(data: any) {
    const qualities = ["360p", "720p", "1080p"];

    const sub: any[] = [];
    const dub: any[] = [];

    for (const q of qualities) {
        const key = `Kiwi-Stream-${q}`;

        const subEncoded = data?.[key]?.sub?.url;
        const dubEncoded = data?.[key]?.dub?.url;

        // SUB
        if (subEncoded) {
            const iframe = await getIframe(subEncoded);
            const stream = iframe
                ? await extractM3U8FromIframe(iframe)
                : null;

            if (stream || iframe) {
                sub.push({
                    quality: q,
                    stream: `https://workers.dev/?url=${encodeURIComponent(stream || iframe)}`,
                    iframe: iframe,
                    download:
                        data?.["Kiwi-Stream"]?.sub?.download?.[key] || null,
                    server: "kiwi",
                });
            }
        }

        // DUB
        if (dubEncoded) {
            const iframe = await getIframe(dubEncoded);
            const stream = iframe
                ? await extractM3U8FromIframe(iframe)
                : null;

            if (stream || iframe) {
                dub.push({
                    quality: q,
                    stream: `https://workers.dev/?url=${encodeURIComponent(stream || iframe)}`,
                    iframe: iframe,
                    download:
                        data?.["Kiwi-Stream"]?.dub?.download?.[key] || null,
                    server: "kiwi",
                });
            }
        }
    }

    // 🔥 Sort qualities
    const order: any = { "360p": 1, "720p": 2, "1080p": 3 };

    sub.sort((a, b) => order[a.quality] - order[b.quality]);
    dub.sort((a, b) => order[a.quality] - order[b.quality]);

    return { sub, dub };
}

// 🚀 API
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ anilistId: string; episode: string }> }
) {
    try {
        const { anilistId, episode } = await params;

        const malId = await getMalId(anilistId);

        if (!malId) {
            return NextResponse.json(
                { success: false, error: "MAL ID not found" },
                { status: 404 }
            );
        }

        const ts = Math.floor(Date.now() / 1000);

        const url = `https://mapper.mewcdn.online/api/mal/${malId}/${episode}/${ts}`;

        const res = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                Referer: "https://mapper.mewcdn.online/",
                Origin: "https://mapper.mewcdn.online",
            },
            cache: "no-store",
        });

        if (!res.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Upstream error: ${res.status}`,
                },
                { status: res.status }
            );
        }

        const raw = await res.json();

        const streams = await formatStreams(raw);

        return NextResponse.json({
            success: true,
            ids: {
                anilist: Number(anilistId),
                mal: malId,
            },
            episode: Number(episode),

            streams,

            meta: {
                cached: raw?.status?.serves_from === "cached",
                expires_in: raw?.status?.cache_expires_in || null,
                timestamp: raw?.status?.time || null,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Internal Server Error",
            },
            { status: 500 }
        );
    }
}
