'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Trophy,
  Bot,
  BarChart3,
  CreditCard,
  Settings,
  Award,
  Menu,
  X,
  BookOpen,
  ShieldCheck,
  Bell,
  ScrollText,
  Zap,
  PackageSearch,
  Globe,
} from 'lucide-react'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { SubscriptionGate } from '@/components/SubscriptionGate'

const navItems = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/dashboard/tenders', label: 'Тендеры', icon: FileText },
  { href: '/dashboard/platforms', label: 'Тендерные площадки', icon: Globe },
  { href: '/dashboard/suppliers', label: 'Поставщики', icon: PackageSearch },
  { href: '/dashboard/ai-agent', label: 'AI-Агент', icon: Bot },
  { href: '/dashboard/ai-generation', label: 'AI-генерация', icon: Zap },
  { href: '/dashboard/knowledge-base', label: 'База знаний RAG', icon: BookOpen },
  { href: '/dashboard/ai-critic', label: 'AI-критик', icon: ShieldCheck },
  { href: '/dashboard/monitoring', label: 'Мониторинг', icon: Bell },
  { href: '/dashboard/analytics', label: 'Аналитика', icon: BarChart3 },
  { href: '/dashboard/decisions', label: 'Реестр решений', icon: ScrollText },
  { href: '/dashboard/billing', label: 'Подписка', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Настройки', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SubscriptionGate>
      <div className="min-h-screen bg-gray-50">
        {/* Мобильный хедер */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Tender AI</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Сайдбар */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Логотип */}
            <div className="p-6 border-b border-gray-200">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">Tender AI</span>
                  <span className="text-xs text-gray-500">Личный кабинет</span>
                </div>
              </Link>
            </div>

            {/* Навигация */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Низ сайдбара: главная + выход */}
            <div className="p-4 border-t border-gray-200 space-y-1">
              <Link
                href="/"
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Trophy className="w-5 h-5" />
                <span className="font-medium">На главную</span>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* Оверлей для мобильного меню */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Контент */}
        <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SubscriptionGate>
  )
}
