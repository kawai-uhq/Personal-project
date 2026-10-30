import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { MangaCard, MangaFeedRow } from '../components/MangaCard';
import { Row } from '../components/Rows';
import { useMangaStore } from '../lib/mangaStore';

/** The manga section's home: manga, manhwa and manhua, powered by AniList. */
export default function MangaHome() {
  const store = useMangaStore();
  const reading = store.history();
  const list = store.list();
  return (
    <main className="page home pad-top">
      <section className="mg-hero container">
        <span className="aex-eyebrow"><Icon name="book" size={14} />MANGA · MANHWA · MANHUA</span>
        <h1 className="title">Read <span className="accent">Comics</span> Online</h1>
        <p className="muted">Thousands of manga, Korean manhwa and Chinese manhua. Pick a title, then read chapter by chapter.</p>
        <div className="mg-kinds">
          <Link to="/manga/explore?country=JP" className="chip">Manga</Link>
          <Link to="/manga/explore?country=KR" className="chip">Manhwa</Link>
          <Link to="/manga/explore?country=CN" className="chip">Manhua</Link>
          <Link to="/manga/explore?format=ONE_SHOT" className="chip">One-shots</Link>
        </div>
      </section>
      {reading.length > 0 && (
        <Row title="Continue Reading" to="/manga/library">
          {reading.map((w) => <MangaCard key={w.id} m={w} tag={w.label.replace('Chapter', 'Ch.')} to={`/manga/read/${w.id}?c=${w.chapterId}`} />)}
        </Row>
      )}
      {list.length > 0 && <Row title="My Manga Library" to="/manga/library">{list.map((m) => <MangaCard key={m.id} m={m} />)}</Row>}
      <MangaFeedRow title="Trending Right Now" q={{ sort: 'TRENDING_DESC' }} to="/manga/explore?sort=TRENDING_DESC" />
      <MangaFeedRow title="Popular Manhwa" q={{ sort: 'POPULARITY_DESC', country: 'KR' }} to="/manga/explore?country=KR&sort=POPULARITY_DESC" />
      <MangaFeedRow title="Popular Manhua" q={{ sort: 'POPULARITY_DESC', country: 'CN' }} to="/manga/explore?country=CN&sort=POPULARITY_DESC" />
      <MangaFeedRow title="All-Time Popular" q={{ sort: 'POPULARITY_DESC', country: 'JP' }} to="/manga/explore?country=JP&sort=POPULARITY_DESC" />
      <MangaFeedRow title="Highest Rated" q={{ sort: 'SCORE_DESC', popularityGreater: 40000 }} to="/manga/explore?sort=SCORE_DESC" />
      <MangaFeedRow title="Action" q={{ sort: 'POPULARITY_DESC', genre: 'Action' }} to="/manga/explore?genre=Action" />
      <MangaFeedRow title="Romance" q={{ sort: 'POPULARITY_DESC', genre: 'Romance' }} to="/manga/explore?genre=Romance" />
      <MangaFeedRow title="Fantasy" q={{ sort: 'POPULARITY_DESC', genre: 'Fantasy' }} to="/manga/explore?genre=Fantasy" />
      <MangaFeedRow title="Horror" q={{ sort: 'POPULARITY_DESC', genre: 'Horror' }} to="/manga/explore?genre=Horror" />
    </main>
  );
}
