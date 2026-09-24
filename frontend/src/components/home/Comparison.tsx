'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

const comparisonData = {
  without: [
    { text: 'Ручной поиск по 8 площадкам', available: false },
    { text: '3-5 часов на подготовку заявки', available: false },
    { text: 'Частые ошибки в Форма 2', available: false },
    { text: 'Отклонения модераторами 15-20%', available: false },
    { text: 'Нужно 5+ логинов/паролей', available: false },
    { text: 'Нет аналитики Win/Loss', available: false },
  ],
  with: [
    { text: 'Единый агрегатор всех ЕТП', available: true },
    { text: '15 минут на генерацию заявки', available: true },
    { text: 'AI проверяет каждое поле', available: true },
    { text: 'Отклонения менее 0.1%', available: true },
    { text: 'Одна ЭЦП для всех площадок', available: true },
    { text: 'Детальная аналитика', available: true },
  ],
}

export function Comparison() {
  return (
    <div>
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Сравнение: <span className="gradient-text">с сервисом и без</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Оцените разницу в эффективности
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Без сервиса */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="bg-gray-100 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-gray-700 mb-6 text-center">
            Без Tender AI
          </h3>
          <ul className="space-y-4">
            {comparisonData.without.map((item, index) => (
              <li key={index} className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-gray-600">{item.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* С сервисом */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white"
        >
          <h3 className="text-2xl font-bold mb-6 text-center">
            С Tender AI Director
          </h3>
          <ul className="space-y-4">
            {comparisonData.with.map((item, index) => (
              <li key={index} className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  )
}