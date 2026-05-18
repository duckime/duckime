"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isInWatchlist, toggleWatchlist } from "@/lib/media";

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

function AnimeDetail() {
  const params = useSearchParams();
  const session = params.get("session") || "";
  const titleHint = params.get("title") || "";

  const [info, setInfo] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingEps, setLoadingEps] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session) { setLoadingInfo(false); return; }

    setSaved(isInWatchlist(session));

    fetch(`/api/animepahe?path=info&id=${session}`)
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {})
      .finally(() => setLoadingInfo(false));

    setLoadingEps(true);
    fetch(`/api/animepahe?path=episodes&id=${session}`)
      .then(r => r.json())
      .then(d => {
        const eps = d.results || [];
        setEpisodes(eps);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(`eps_${session}`, JSON.stringify(eps));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEps(false));
  }, [session]);

  const title = info?.name || titleHint || "loading...";
  const titleToSave = info?.name || titleHint || "anime";
  const poster = info?.poster || "";

  const toggleList = () => {
    if (!session) return;
    const next = toggleWatchlist({
      session,
      title: titleToSave,
      poster,
      href: `/anime?session=${session}${titleHint ? `&title=${encodeURIComponent(titleHint)}` : ""}`,
    });
    setSaved(next.added);
    setNotice(next.added ? "added to watch list" : "removed from watch list");
    window.setTimeout(() => setNotice(""), 1600);
  };

  return (
    <>
      <Nav />

      {info?.background && (
        <div className="banner-wrap">
          <img className="banner-img" src={info.background} alt="" />
          <div className="banner-fade" />
        </div>
      )}

      <div className="detail-layout" style={!info?.background ? { marginTop: 24 } : {}}>
        <div className="detail-poster">
          {info?.poster && (
            <img src={info.poster} alt={title}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>
        <div className="detail-info" style={!info?.background ? { paddingTop: 0 } : {}}>
          {loadingInfo
            ? <div className="loading-msg">loading...</div>
            : (
            <>
              <div className="detail-headline">
                <h1 className="detail-title">{title}</h1>
                <button className={`watchlist-btn${saved ? " active" : ""}`} onClick={toggleList}>
                  {saved ? "remove from list" : "add to list"}
                </button>
              </div>
              {notice && <div className="notice">{notice}</div>}
              <div className="badges-row">
                {info?.aired && <span className="badge">{info.aired.split(" to ")[0]}</span>}
                {info?.duration && <span className="badge">{info.duration}</span>}
                {(info?.genres || []).slice(0, 5).map((g: string, i: number) => (
                  <span key={i} className="badge accent">{g}</span>
                ))}
              </div>
              {info?.description && (
                <p className="synopsis"
                  dangerouslySetInnerHTML={{
                    __html: info.description.replace(/<[^>]+>/g, "").slice(0, 400) + (info.description.length > 400 ? "..." : "")
                  }} />
              )}
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>episodes</div>
            {loadingEps
              ? <div className="loading-msg">loading episodes...</div>
              : episodes.length === 0
              ? <div className="loading-msg">no episodes found</div>
              : (
                <div className="ep-grid">
                  {episodes.map((ep, i) => (
                    <a key={i}
                      className={`ep-btn${ep.filler ? " filler" : ""}`}
                      href={`/watch?anime_session=${session}&ep_session=${ep.session}&ep_num=${ep.episode}`}
                      title={ep.filler ? "filler" : `episode ${ep.episode}`}>
                      {ep.episode}
                    </a>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      </div>
      <div style={{ height: 48 }} />
    </>
  );
}

export default function AnimePage() {
  return (
    <Suspense fallback={<div className="loading-msg">loading...</div>}>
      <AnimeDetail />
    </Suspense>
  );
}
