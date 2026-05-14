import CreateRoomButton from '@/components/CreateRoomButton'
import JoinRoomForm from '@/components/JoinRoomForm'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-16 sm:px-10">
      <section className="w-full max-w-3xl rounded-[2rem] border border-slate-800/90 bg-slate-950/70 p-8 shadow-glow backdrop-blur sm:p-12">
        <div className="space-y-10 text-center">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
              PlayPoll
            </span>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                PlayPoll
              </h1>
              <p className="text-base text-slate-300 sm:text-lg">Elegí. Votá. Jugá.</p>
            </div>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Creá una sala en segundos o sumate con un link de invitación para empezar a
              proponer y votar juegos sin vueltas.
            </p>
          </div>

          <div className="mx-auto flex max-w-md justify-center">
            <CreateRoomButton className="w-full px-6 py-3.5 text-base" />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 text-left sm:p-6">
            <JoinRoomForm />
          </div>
        </div>
      </section>
    </main>
  )
}
