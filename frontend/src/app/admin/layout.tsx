'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, Settings, Bot, CreditCard, Mail, Globe, Play, Activity, Award, Menu, X, Newspaper, PackageSearch } from 'lucide-react'
import { LogoutButton } from '@/components/layout/LogoutButton'
import { api } from '@/lib/api'

const navItems = [
  { href: '/admin', label: 'Обзор', icon: Activity },
  { href: '/admin/settings', label: 'Настройки сайта', icon: Settings },
  { href: '/admin/suppliers', label: 'Поставщики', icon: PackageSearch },
  { href: '/admin/ai-models', label: 'AI Модели', icon: Bot },
  { href: '/admin/subscriptions', label: 'Подписки', icon: CreditCard },
  { href: '/admin/support', label: 'Обращения', icon: Mail },
  { href: '/admin/platforms', label: 'Тендерные площадки', icon: Globe },
  { href: '/admin/parsing', label: 'Парсинг', icon: Play },
  { href: '/admin/articles', label: 'Статьи', icon: Newspaper },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Проверка прав: панель открывается только после входа администратора
  const [ready, setReady] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) {
      setReady(true)
      return
    }
    let cancelled = false

    const verify = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      if (!token) {
        router.replace('/admin/login')
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (String(data?.role).toLowerCase() !== 'admin') {
          // Токен валиден, но прав нет: уходим на вход, не сбрасывая сессию пользователя
          if (!cancelled) router.replace('/admin/login?error=forbidden')
          return
        }
        if (!cancelled) setReady(true)
      } catch {
        // Невалидный токен (интерцептор уже убрал его) или сервер недоступен
        if (!cancelled) router.replace('/admin/login')
      }
    }
    verify()

    return () => {
      cancelled = true
    }
  }, [isLoginPage, pathname, router])

  // Страница авторизации администратора — без сайдбара и без проверки
  if (isLoginPage) return <>{children}</>

  // Пока проверяем права — экран загрузки, чтобы контент не мигал
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Award className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          <p className="text-sm text-gray-400">Проверяем права администратора…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Мобильный хедер */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Админ-панель</span>
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
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Логотип */}
          <div className="p-6 border-b border-gray-800">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-white block">Tender AI</span>
                <span className="text-xs text-gray-400">Админ-панель</span>
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
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Низ сайдбара: кабинет + выход */}
          <div className="p-4 border-t border-gray-800 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Activity className="w-5 h-5" />
              <span className="font-medium">Кабинет</span>
            </Link>
            <LogoutButton tone="dark" loginHref="/admin/login?logout=1" />
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
  )
}
