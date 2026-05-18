"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaCardItem, readHistory, readWatchlist } from "@/lib/media";

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

function MediaStrip({ items, emptyText, variant }: { items: MediaCardItem[]; emptyText: string; variant: "list" | "history" }) {
  if (!items.length) {
    return <div className="loading-msg">{emptyText}</div>;
  }

  return (
    <div className="media-strip">
      {items.map((item) => (
        <a key={`${item.session}:${item.episode ?? "list"}`} className="media-card" href={item.href || `/anime?session=${item.session}` }>
          {item.poster ? (
            <img
              src={item.poster}
              alt={item.title}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="media-placeholder" />
          )}
          <div className="media-card-info">
            <div className="media-card-title">{item.title}</div>
            <div className="media-card-sub">
              {variant === "history" && item.episode ? `episode ${item.episode}` : "watch list"}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  const [latest, setLatest] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<MediaCardItem[]>([]);
  const [history, setHistory] = useState<MediaCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const syncLists = () => {
    setWatchlist(readWatchlist());
    setHistory(readHistory());
  };

  useEffect(() => {
    fetch("/api/animepahe?path=latest")
      .then(r => r.json())
      .then(d => setLatest(d.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    syncLists();
    const onStorage = () => syncLists();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      <Nav />
      <div className="section">
        <div className="section-label">latest episodes</div>
        <div className="strip">
          {loading
            ? <div className="loading-msg">loading...</div>
            : latest.map((a, i) => (
              <a key={i} className="hero-card"
                href={`/anime?session=${a.id}&title=${encodeURIComponent(a.title)}`}>
                <img src={a.snapshot} alt={a.title}
                  onError={e => { (e.target as HTMLImageElement).style.background = "#1a1a1a"; }} />
                <div className="hero-card-info">
                  <div className="hero-card-title">{a.title}</div>
                  <div className="hero-card-ep">ep {a.episode}</div>
                </div>
              </a>
            ))
          }
        </div>
      </div>

      <div className="section">
        <div className="section-label">watch list</div>
        <MediaStrip items={watchlist} emptyText="nothing saved yet" variant="list" />
      </div>

      <div className="section">
        <div className="section-label">watch history</div>
        <MediaStrip items={history} emptyText="nothing watched yet" variant="history" />
      </div>

      <div style={{ height: 40 }} />
    </>
  );
}
