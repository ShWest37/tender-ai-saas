import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['cyrillic', 'latin'] })

export const metadata: Metadata = {
  title: 'Tender AI Director — Автоматизация тендеров с искусственным интеллектом',
  description: 'SaaS-сервис для автоматизации работы с тендерами. AI-генерация заявок, анализ площадок, реестр решений.',
  keywords: 'тендеры, госзакупки, ФЗ-44, ФЗ-223, автоматизация, AI, искусственный интеллект',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  )
}