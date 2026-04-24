# Viciemos

> Una app en tiempo real para armar rooms, proponer juegos, votar y cerrar la partida sin refresh.

## Qué hace

- Crea salas para jugar con amigos.
- Los jugadores entran en tiempo real.
- Se proponen juegos con autocomplete.
- Se vota en vivo y se muestran porcentajes.
- Un host controla el flujo de la partida.

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase Realtime

## Arranque rápido

```bash
npm install
npm run dev
```

## Variables de entorno

Creá un `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## Estado

Proyecto en desarrollo. La base ya está lista para seguir sumando lógica de juego.
