import type { Metadata } from 'next'
import { Inter, Noto_Sans_TC } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EatQ CRM — 業務開發系統',
  description: 'EatQ 餐飲業務開發 CRM 平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`${inter.variable} ${notoSansTC.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
