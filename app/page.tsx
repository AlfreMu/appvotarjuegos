import Link from 'next/link'
import SupabaseTest from '@/components/SupabaseTest'
import CreateRoomButton from '@/components/CreateRoomButton'

const highlights = [
  {
    title: 'App Router',
    description: 'File-based routing is ready from the root layout onward.',
  },
  {
    title: 'Tailwind CSS',
    description: 'Global styles and utility classes are wired up for fast iteration.',
  },
  {
    title: 'Supabase',
    description: 'The client helper is prepared for environment-based configuration.',
  },
]

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-10">
      <section className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          <span className="inline-flex rounded-full border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-xs font-medium tracking-[0.2em] text-slate-300 uppercase shadow-glow">
            Scaffold ready
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Viciemos is ready for rooms, realtime features, and whatever we add next.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              The project is set up with Next.js 14, TypeScript, Tailwind CSS, and a
              Supabase client helper. The next step can focus entirely on product logic.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/room/demo"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
            >
              Open sample room
            </Link>
            <CreateRoomButton />
            <span className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200">
              App Router enabled
            </span>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-800/90 bg-slate-950/60 p-6 shadow-glow backdrop-blur">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">
              Project structure
            </p>
            <div className="space-y-3">
              {highlights.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                >
                  <h2 className="text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <SupabaseTest />
    </main>
  )
}
