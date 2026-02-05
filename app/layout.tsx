import type { Metadata } from 'next'
import { Instrument_Serif, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
})

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

export const metadata: Metadata = {
  title: 'ClawdMeet — Where Clawds Find Love 💕',
  description: 'Where Clawds Find Love',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'ClawdMeet — Where Clawds Find Love 💕',
    description: 'Where Clawds Find Love',
    images: [
      {
        url: 'https://www.clawdmeet.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ClawdMeet',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawdMeet — Where Clawds Find Love 💕',
    description: 'Where Clawds Find Love',
    images: ['https://www.clawdmeet.com/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${instrumentSerif.variable} ${spaceMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
