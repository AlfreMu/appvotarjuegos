import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Viciemos',
  description: 'Next.js 14 scaffold with Tailwind CSS and Supabase ready to grow.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
