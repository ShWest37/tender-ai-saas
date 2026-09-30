'use client'

import { motion } from 'framer-motion'
import { Bot, Database, Shield, Zap, BarChart3, Globe } from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'AI-генерация заявок',
    description: 'Искусственный интеллект автоматически заполняет все поля заявки на основе документации и вашего профиля компании',
    color: 'blue',
  },
  {
    icon: Database,
    title: 'База знаний RAG',
    description: 'Векторный поиск по ГОСТам, ФЗ-44, прошлым заявкам и реквизитам компании для точных ответов',
    color: 'purple',
  },
  {
    icon: Shield,
    title: 'AI-критик',
    description: 'Вторая AI-модель проверяет заявку на соответствие требованиям и находит ошибки до отправки',
    color: 'green',
  },
  {
    icon: Zap,
    title: 'Автоматический мониторинг',
    description: 'Автоматический сбор тендеров и уведомления о новых закупках каждые 15 минут',
    color: 'yellow',
  },
  {
    icon: BarChart3,
    title: 'Аналитика Win/Loss',
    description: 'Детальная статистика побед и поражений, среднее место, причины отклонений',
    color: 'red',
  },
  {
    icon: Globe,
    title: 'Единая ЭЦП',
    description: 'Подписание и подача заявок через одну ЭЦП без регистрации на каждой площадке',
    color: 'cyan',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

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

export function Features() {
  return (
    <div>
      <div className="text-center mb-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          О сервисе <span className="gradient-text">Tender AI Director</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Полная автоматизация работы с государственными и корпоративными закупками
        </motion.p>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {features.map((feature, index) => {
          const Icon = feature.icon
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-600',
            purple: 'bg-purple-100 text-purple-600',
            green: 'bg-green-100 text-green-600',
            yellow: 'bg-yellow-100 text-yellow-600',
            red: 'bg-red-100 text-red-600',
            cyan: 'bg-cyan-100 text-cyan-600',
          }

          const variants = index % 2 === 0 ? itemVariantsLeft : itemVariantsRight

          return (
            <motion.div
              key={index}
              variants={variants}
              className="card group hover:-translate-y-2 transition-all duration-300 hover:shadow-lg"
            >
              <div className={`w-14 h-14 rounded-xl ${colorClasses[feature.color as keyof typeof colorClasses]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
