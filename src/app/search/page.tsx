"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Nav({ defaultQ = "" }: { defaultQ?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQ);
  useEffect(() => { setQ(defaultQ); }, [defaultQ]);
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

function SearchResults() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setResults([]);
    fetch(`/api/animepahe?path=search&query=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(d => setResults(d.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <>
      <Nav defaultQ={query} />
      <div className="search-heading">
        {query ? <>results for <span>"{query}"</span></> : "search"}
      </div>
      {loading && <div className="loading-msg">searching...</div>}
      {!loading && results.length === 0 && query && (
        <div className="loading-msg">no results found</div>
      )}
      <div className="grid">
        {results.map((a, i) => (
          <a key={i} className="card"
            href={`/anime?session=${a.session}&title=${encodeURIComponent(a.title)}`}>
            <img className="card-img" src={a.poster} alt={a.title} loading="lazy"
              onError={e => { (e.target as HTMLImageElement).style.background = "#1a1a1a"; }} />
            <div className="card-title">{a.title}</div>
            <div className="card-sub">{[a.type, a.year].filter(Boolean).join(" · ")}</div>
          </a>
        ))}
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="loading-msg">loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}
