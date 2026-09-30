'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqItems = [
  {
    question: 'Как работает AI-генерация заявок?',
    answer:
      'Наш AI анализирует документацию тендера, ваш профиль компании и базу знаний (ГОСТы, ФЗ-44, прошлые заявки). Затем автоматически заполняет все поля Формы 2, проверяет на ошибки и готовит заявку к подаче. Весь процесс занимает около 15 минут.',
  },
  {
    question: 'Что такое AI-критик?',
    answer:
      'AI-критик — это вторая AI-модель, которая проверяет сгенерированную заявку на соответствие требованиям тендера. Она находит ошибки, неточности и несоответствия, которые могут привести к отклонению заявки модератором. Точность проверки достигает 99.9%.',
  },
  {
    question: 'Нужна ли мне ЭЦП для работы с сервисом?',
    answer:
      'Да, для подачи заявок на электронных торговых площадках требуется электронная цифровая подпись (ЭЦП). Наш сервис позволяет использовать одну ЭЦП для подачи заявок без необходимости регистрации на каждой площадке отдельно.',
  },
  {
    question: 'Как проходит интеграция с нашей системой?',
    answer:
      'Интеграция занимает от 1 до 3 дней. Мы предоставляем REST API для подключения к вашей CRM или внутренней системе. Наша команда помогает с настройкой и проводит обучение ваших сотрудников.',
  },
  {
    question: 'Что входит в бесплатный пробный период?',
    answer:
      'В течение 3 дней вы получаете полный доступ ко всем функциям тарифа "Бизнес": AI-генерация заявок, AI-критик, аналитика Win/Loss, поддержка нескольких пользователей. Банковская карта не требуется.',
  },
  {
    question: 'Можно ли отменить подписку в любой момент?',
    answer:
      'Да, вы можете отменить подписку в любой момент в личном кабинете. Доступ сохраняется до конца оплаченного периода. Никаких скрытых платежей и штрафов за отмену.',
  },
  {
    question: 'Как обеспечивается безопасность данных?',
    answer:
      'Мы используем шифрование AES-256 для хранения данных и TLS 1.3 для передачи. Серверы расположены в России (соответствие 152-ФЗ). Доступ к данным строго ограничен и логируется.',
  },
  {
    question: 'Подходит ли сервис для тендерных агентств?',
    answer:
      'Да, тариф Enterprise разработан специально для тендерных агентств. Он включает безлимитное количество пользователей, white-label решение, выделенный AI-кластер и персонального менеджера.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariantsLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const itemVariantsRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div>
      <div className="text-center mb-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          Часто задаваемые <span className="gradient-text">вопросы</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Ответы на популярные вопросы о сервисе
        </motion.p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Left column */}
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {faqItems.slice(0, 4).map((item, index) => (
            <motion.div
              key={index}
              variants={itemVariantsLeft}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-semibold text-gray-900 pr-4">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-gray-600 leading-relaxed">{item.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        {/* Right column */}
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {faqItems.slice(4).map((item, index) => {
            const actualIndex = index + 4
            return (
              <motion.div
                key={actualIndex}
                variants={itemVariantsRight}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === actualIndex ? null : actualIndex)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-semibold text-gray-900 pr-4">{item.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${
                      openIndex === actualIndex ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {openIndex === actualIndex && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-gray-600 leading-relaxed">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
