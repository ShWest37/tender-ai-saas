'use client'

import { motion } from 'framer-motion'
import { Clock, DollarSign, TrendingUp, CheckCircle } from 'lucide-react'

const benefits = [
  {
    icon: Clock,
    title: 'Экономия времени',
    value: '90%',
    description: 'Сокращение времени на подготовку заявки с 3 часов до 15 минут',
  },
  {
    icon: DollarSign,
    title: 'Экономия на ФОТ',
    value: '50%',
    description: 'Один AI-агент заменяет половину работы тендерного специалиста',
  },
  {
    icon: TrendingUp,
    title: 'Рост побед',
    value: '+35%',
    description: 'Увеличение количества выигранных тендеров благодаря точности',
  },
  {
    icon: CheckCircle,
    title: 'Снижение ошибок',
    value: '99.9%',
    description: 'Практически полное исключение отклонений из-за ошибок в заявке',
  },
]

const itemVariantsLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const itemVariantsRight = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

export function Benefits() {
  return (
    <div>
      <div className="text-center mb-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          Преимущества <span className="gradient-text">автоматизации</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Реальные результаты наших клиентов
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {benefits.map((benefit, index) => {
          const Icon = benefit.icon
          const variants = index % 2 === 0 ? itemVariantsLeft : itemVariantsRight

          return (
            <motion.div
              key={index}
              variants={variants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-center p-6"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                <Icon className="w-8 h-8 text-white" />
              </div>
              <div className="text-4xl font-bold gradient-text mb-2">
                {benefit.value}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {benefit.title}
              </h3>
              <p className="text-gray-600">
                {benefit.description}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
