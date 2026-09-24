'use client'

import { motion } from 'framer-motion'

const platforms = [
  'Сбербанк-АСТ',
  'РТС-тендер',
  'Росэлторг',
  'ТЭК-Торг',
  'Газпромбанк',
  'НЭП',
  'ЕЭТП',
  'АГЗ РТ',
]

export function PlatformSlider() {
  return (
    <div className="text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
        Работаем со всеми основными <span className="gradient-text">площадками</span>
      </h2>

      <div className="relative overflow-hidden">
        <motion.div
          className="flex space-x-8"
          animate={{ x: [0, -1000] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          {[...platforms, ...platforms].map((platform, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-48 h-24 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center p-4 hover:shadow-md transition-shadow"
            >
              <span className="text-gray-700 font-semibold text-center">
                {platform}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}