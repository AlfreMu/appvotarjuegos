import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PlayPoll – Votá tu juego',
  description: 'PlayPoll – Votá tu juego con tu sala, propuestas y desempate en ruleta.',
  manifest: '/logos/site.webmanifest',
  icons: {
    icon: [
      { url: '/logos/favicon.ico' },
      { url: '/logos/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logos/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: ['/logos/favicon.ico'],
    apple: [{ url: '/logos/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
