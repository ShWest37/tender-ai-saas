'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Award } from 'lucide-react'
import { RegisterModal } from '@/components/modals/RegisterModal'
import { LoginModal } from '@/components/modals/LoginModal'

const navItems = [
  { href: '#about', label: 'О сервисе' },
  { href: '#benefits', label: 'Преимущества' },
  { href: '#comparison', label: 'Сравнение' },
  { href: '#roi', label: 'Выгоды' },
  { href: '#pricing', label: 'Тарифы' },
  { href: '/blog', label: 'Блог' },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Логотип */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <span className={`font-bold text-xl ${isScrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                Tender AI
              </span>
            </Link>

            {/* Десктоп меню */}
            <nav className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-blue-500 ${
                    isScrolled ? 'text-gray-700' : 'text-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Кнопки */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => setShowLoginModal(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isScrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-700 hover:bg-white/10'
                }`}
              >
                Войти
              </button>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                Начать бесплатно
              </button>
            </div>

            {/* Мобильное меню кнопка */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-700"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t"
            >
              <div className="container mx-auto px-4 py-4 space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-2 text-gray-700 hover:text-blue-500 font-medium"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      setShowLoginModal(true)
                    }}
                    className="w-full py-3 text-center border border-gray-300 rounded-lg font-medium"
                  >
                    Войти
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      setShowRegisterModal(true)
                    }}
                    className="w-full btn-primary py-3"
                  >
                    Начать бесплатно
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onOpenLogin={() => {
          setShowRegisterModal(false)
          setShowLoginModal(true)
        }}
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onOpenRegister={() => {
          setShowLoginModal(false)
          setShowRegisterModal(true)
        }}
      />
    </>
  )
}