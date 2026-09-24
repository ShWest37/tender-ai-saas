'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <div className="text-center text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-6">
          Готовы выигрывать больше тендеров?
        </h2>
        <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
          Начните бесплатно прямо сейчас. 3 дня полного доступа ко всем функциям.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors flex items-center space-x-2">
            <span>Начать бесплатно</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <button className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors">
            Заказать демо
          </button>
        </div>
        <p className="mt-6 text-sm text-white/70">
          Не требуется банковская карта • Отмена в любой момент
        </p>
      </motion.div>
    </div>
  )
}