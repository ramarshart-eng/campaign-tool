import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-app text-fg p-8">
      <h1 className="text-3xl font-semibold">Campaign Tool Prototype</h1>
      <p className="max-w-xl text-center text-muted">
        Explore the DM tools currently in development. Start with the new DM
        Hub or jump directly into notes and player views.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/prototype/dm-hub" className="btn-primary">
          Open DM Hub
        </Link>
        <Link href="/prototype/dm-notes" className="btn-primary">
          Notes Book Prototype
        </Link>
        <Link href="/prototype/player-notes" className="btn-primary">
          Player View Prototype
        </Link>
      </div>
    </main>
  );
}

