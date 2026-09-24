import Link from 'next/link'
import { Award, Mail, Phone, MapPin, Github, Twitter, Linkedin } from 'lucide-react'

const footerLinks = {
  product: [
    { href: '#features', label: 'Возможности' },
    { href: '#pricing', label: 'Тарифы' },
    { href: '#platforms', label: 'Площадки' },
    { href: '/blog', label: 'Блог' },
  ],
  company: [
    { href: '#about', label: 'О нас' },
    { href: '#contact', label: 'Контакты' },
    { href: '/privacy', label: 'Политика конфиденциальности' },
    { href: '/terms', label: 'Условия использования' },
  ],
  support: [
    { href: '/help', label: 'Помощь' },
    { href: '/api-docs', label: 'API документация' },
    { href: '/status', label: 'Статус системы' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Логотип и описание */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-white">Tender AI</span>
            </Link>
            <p className="text-gray-400 mb-6 max-w-sm">
              Автоматизация тендеров с искусственным интеллектом. 
              Экономьте время и выигрывайте больше закупок.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Продукт */}
          <div>
            <h3 className="text-white font-semibold mb-4">Продукт</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Компания */}
          <div>
            <h3 className="text-white font-semibold mb-4">Компания</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Поддержка */}
          <div>
            <h3 className="text-white font-semibold mb-4">Поддержка</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Контакты */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-blue-500" />
              <span>support@tenderai.ru</span>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-blue-500" />
              <span>+7 (999) 123-45-67</span>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-blue-500" />
              <span>Москва, ул. Примерная, 123</span>
            </div>
          </div>
        </div>

        {/* Копирайт */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Tender AI Director. Все права защищены.</p>
        </div>
      </div>
    </footer>
  )
}