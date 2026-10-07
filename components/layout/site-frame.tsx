import Link from "next/link";

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <main>
      {" "}
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-icon">ll</span> llm dictionary
          <span className="edition">An experiment in language</span>
        </Link>
        <span className="header-note">Words have more to say.</span>
      </header>
      <section className="intro">
        <div className="eyebrow">MEANING / ASSOCIATION / DISCOVERY</div>
        <h1>
          A word is just
          <br />
          the <em>beginning.</em>
        </h1>
        <p>
          Find its meaning. Follow its connections.
          <br />
          See where language takes you.
        </p>
        <span className="intro-index">
          Aa<span>01 — ∞</span>
        </span>
      </section>
      {children}{" "}
      <footer>
        <span>
          llm dictionary <i>—</i> a place for curious minds
        </span>
        <span>Powered by Gemini · Results saved for next time</span>
      </footer>
    </main>
  );
}
