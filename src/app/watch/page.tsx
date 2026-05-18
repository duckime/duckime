"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { upsertHistory } from "@/lib/media";

declare global {
  interface Window { Hls: any; }
}

function Nav() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = () => { if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); };
  return (
    <nav className="nav">
      <a href="/" className="logo">duck<span>ime</span></a>
      <div className="search-bar">
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && go()}
          placeholder="search anime..." />
        <button onClick={go}>search</button>
      </div>
    </nav>
  );
}

function WatchContent() {
  const params = useSearchParams();
  const animeSession = params.get("anime_session") || "";
  const epSession = params.get("ep_session") || "";
  const epNum = parseInt(params.get("ep_num") || "1", 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  const [streams, setStreams] = useState<{ sub: any[]; dub: any[] }>({ sub: [], dub: [] });
  const [audio, setAudio] = useState<"sub" | "dub">("sub");
  const [qualityIdx, setQualityIdx] = useState(0);
  const [status, setStatus] = useState("loading streams...");
  const [allEps, setAllEps] = useState<any[]>([]);
  const [animeName, setAnimeName] = useState("");
  const [animePoster, setAnimePoster] = useState("");
  const [downloadHref, setDownloadHref] = useState<string | null>(null);

  useEffect(() => {
    if (window.Hls) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js";
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!animeSession) return;
    try {
      const stored = sessionStorage.getItem(`eps_${animeSession}`);
      if (stored) setAllEps(JSON.parse(stored));
    } catch {}
  }, [animeSession]);

  useEffect(() => {
    if (!animeSession || !epSession) {
      setStatus("missing session info");
      return;
    }
    setStatus("fetching stream...");
    setStreams({ sub: [], dub: [] });
    setDownloadHref(null);

    fetch(`/api/animepahe?path=episode&id=${animeSession}&session=${epSession}`)
      .then(r => r.json())
      .then(d => {
        const sub = d.sub || [];
        const dub = d.dub || [];
        setStreams({ sub, dub });

        const defaultList = sub.length ? sub : dub;
        setDownloadHref(defaultList?.[0]?.downloadUrl || null);

        if (sub.length === 0 && dub.length === 0) {
          setStatus("no streams found — try another episode");
        } else {
          setStatus("");
        }
      })
      .catch(() => setStatus("failed to load streams"));
  }, [animeSession, epSession]);

  useEffect(() => {
    if (!animeSession) return;
    fetch(`/api/animepahe?path=info&id=${animeSession}`)
      .then(r => r.json())
      .then(d => {
        setAnimeName(d.name || "");
        setAnimePoster(d.poster || "");
      })
      .catch(() => {});
  }, [animeSession]);

  useEffect(() => {
    if (!animeSession) return;
    const historyTitle = animeName || `anime ${animeSession}`;
    upsertHistory({
      session: animeSession,
      title: historyTitle,
      poster: animePoster,
      episode: epNum,
      href: `/watch?anime_session=${animeSession}&ep_session=${epSession}&ep_num=${epNum}`,
    });
  }, [animeSession, animeName, animePoster, epSession, epNum]);

  useEffect(() => {
    const list = audio === "sub" ? streams.sub : streams.dub;
    if (!list.length) return;

    const idx = Math.min(qualityIdx, list.length - 1);
    const stream = list[idx];
    if (!stream?.m3u8Url) {
      setStatus("stream URL not available");
      return;
    }

    setDownloadHref(stream.downloadUrl || null);
    playUrl(stream.m3u8Url);
  }, [streams, audio, qualityIdx]);

  function playUrl(url: string) {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const tryPlay = () => {
      if (window.Hls?.isSupported()) {
        const hls = new window.Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setStatus("");
        });
        hls.on(window.Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) setStatus("stream error — try another quality");
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().catch(() => {});
        setStatus("");
      } else {
        setStatus("HLS not supported in this browser");
      }
    };

    if (window.Hls) {
      tryPlay();
    } else {
      const check = setInterval(() => {
        if (window.Hls) { clearInterval(check); tryPlay(); }
      }, 100);
    }
  }

  const currentIdx = allEps.findIndex(e => e.episode === epNum);
  const prevEp = currentIdx > 0 ? allEps[currentIdx - 1] : null;
  const nextEp = currentIdx >= 0 && currentIdx < allEps.length - 1 ? allEps[currentIdx + 1] : null;

  const epUrl = (ep: any) =>
    `/watch?anime_session=${animeSession}&ep_session=${ep.session}&ep_num=${ep.episode}`;

  const activeSubs = audio === "sub" ? streams.sub : streams.dub;
  const downloadLabel = downloadHref ? "download episode" : "download unavailable";

  return (
    <>
      <Nav />
      <div className="player-wrap">
        <video ref={videoRef} controls playsInline />
      </div>

      <div className="player-bar">
        <div className="player-title">
          {animeName ? `${animeName} — ep ${epNum}` : `episode ${epNum}`}
        </div>

        {status && (
          <span style={{ fontSize: 12, color: "var(--accent)", fontFamily: "Space Mono, monospace" }}>
            {status}
          </span>
        )}

        {(streams.sub.length > 0 || streams.dub.length > 0) && (
          <div className="audio-toggle">
            <button className={`audio-btn${audio === "sub" ? " active" : ""}`}
              onClick={() => { setAudio("sub"); setQualityIdx(0); }}>SUB</button>
            {streams.dub.length > 0 && (
              <button className={`audio-btn${audio === "dub" ? " active" : ""}`}
                onClick={() => { setAudio("dub"); setQualityIdx(0); }}>DUB</button>
            )}
          </div>
        )}

        {activeSubs.length > 1 && (
          <select className="quality-select"
            value={qualityIdx}
            onChange={e => setQualityIdx(parseInt(e.target.value))}>
            {activeSubs.map((s, i) => (
              <option key={i} value={i}>{s.quality || `source ${i + 1}`}</option>
            ))}
          </select>
        )}

        <button
          className={`nav-btn${downloadHref ? "" : " disabled"}`}
          disabled={!downloadHref}
          onClick={() => {
            const video = videoRef.current;
            const src = video?.currentSrc || video?.src || downloadHref;

            if (!src) return;

            const a = document.createElement("a");
            a.href = src;
            a.download = `${animeName || "episode"}-ep-${epNum}.mp4`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }}
        >
          {downloadLabel}
        </button>

        <div className="nav-btns">
          {prevEp
            ? <a className="nav-btn" href={epUrl(prevEp)}>← prev</a>
            : <span className="nav-btn disabled">← prev</span>
          }
          <a className="nav-btn" href={`/anime?session=${animeSession}`}>all eps</a>
          {nextEp
            ? <a className="nav-btn" href={epUrl(nextEp)}>next →</a>
            : <span className="nav-btn disabled">next →</span>
          }
        </div>
      </div>

      {allEps.length > 0 && (
        <div className="section" style={{ paddingBottom: 40 }}>
          <div className="section-label">episodes</div>
          <div className="ep-grid">
            {allEps.map((ep, i) => (
              <a key={i} className={`ep-btn${ep.episode === epNum ? " active" : ""}${ep.filler ? " filler" : ""}`}
                href={epUrl(ep)}>
                {ep.episode}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="loading-msg">loading...</div>}>
      <WatchContent />
    </Suspense>
  );
}
