'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator } from 'lucide-react'

export function UIPTypes() {
  const [applicationsPerMonth, setApplicationsPerMonth] = useState(20)
  const specialistSalary = 80000 // Средняя зарплата тендерного специалиста
  const hoursPerApplication = 3 // Часов на одну заявку вручную
  const hoursPerApplicationAI = 0.25 // 15 минут с AI

  const savings = {
    time: (applicationsPerMonth * hoursPerApplication - applicationsPerMonth * hoursPerApplicationAI).toFixed(0),
    money: Math.round((applicationsPerMonth * hoursPerApplication * specialistSalary / 160) - 35000), // 35000 - цена подписки
  }

  return (
    <div>
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Выгоды и <span className="gradient-text">ROI</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Калькулятор экономии
        </p>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center mb-8">
          <Calculator className="w-12 h-12 text-blue-500" />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Количество заявок в месяц: {applicationsPerMonth}
          </label>
          <input
            type="range"
            min="5"
            max="100"
            value={applicationsPerMonth}
            onChange={(e) => setApplicationsPerMonth(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5</span>
            <span>100</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {savings.time} ч
            </div>
            <div className="text-sm text-gray-600">
              Экономия времени в месяц
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {savings.money.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-sm text-gray-600">
              Экономия денег в месяц
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          При стоимости подписки 35 000 ₽/мес
        </div>
      </div>
    </div>
  )
}