# PlayPoll

> Una app en tiempo real para decidir qué jugar con amigos en pocos minutos.

PlayPoll permite crear una sala, compartir un link, proponer juegos, votar en vivo y resolver empates con una ruleta. La idea es simple: pasar más rápido de “¿qué jugamos?” a jugar.

## Qué hace

- Crea salas e invita jugadores con un link
- Permite elegir nombre y avatar
- Recibe propuestas de juegos sin duplicados
- Actualiza votos en tiempo real
- Resuelve empates y muestra un ganador final

## Stack

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Supabase

## Desarrollo local

```bash
npm install
npm run dev
```

## Variables de entorno

Creá un archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## Docker

Build de la imagen:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=tu_url \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key \
  -t playpoll:local .
```

Ejecucion del contenedor:

```bash
docker run --rm -p 3000:3000 playpoll:local
```

Notas:

- El contenedor expone el puerto `3000`.
- Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se inyectan en build.
- El despliegue productivo principal sigue estando en Vercel.

## Estado actual

PlayPoll está en una versión MVP funcional. Ya permite crear salas, proponer juegos, votar, desempatar y cerrar una partida completa.

## Próximos pasos

- Pulir todavía más la experiencia visual de la ruleta
- Mejorar observabilidad y despliegue
- Sumar CI/CD e infraestructura para portfolio DevOps
