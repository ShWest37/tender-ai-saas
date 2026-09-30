'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingUp, Clock, DollarSign } from 'lucide-react'

export function UIPTypes() {
  const [avgTenderSum, setAvgTenderSum] = useState(500000)
  const [winRate, setWinRate] = useState(30)
  const [tendersPerMonth, setTendersPerMonth] = useState(10)
  const [marginPercent, setMarginPercent] = useState(15)

  const subscriptionPrice = 35000
  const avgWinRateWithAI = Math.min(winRate + 35, 80)
  const monthlyWins = Math.round((tendersPerMonth * avgWinRateWithAI) / 100)
  const monthlyRevenue = monthlyWins * avgTenderSum
  const monthlyProfit = Math.round((monthlyRevenue * marginPercent) / 100)
  const netProfit = monthlyProfit - subscriptionPrice
  const roi = Math.round(((netProfit / subscriptionPrice) * 100))

  return (
    <div>
      <div className="text-center mb-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          Калькулятор <span className="gradient-text">потенциального заработка</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Узнайте, сколько вы можете зарабатывать с Tender AI Director
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <Calculator className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Средняя сумма тендера */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Средняя сумма тендера: <span className="text-blue-600 font-bold">{avgTenderSum.toLocaleString('ru-RU')} ₽</span>
            </label>
            <input
              type="range"
              min="100000"
              max="5000000"
              step="50000"
              value={avgTenderSum}
              onChange={(e) => setAvgTenderSum(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>100 тыс.</span>
              <span>5 млн</span>
            </div>
          </div>

          {/* Текущий процент побед */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ваш текущий % побед: <span className="text-blue-600 font-bold">{winRate}%</span>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={winRate}
              onChange={(e) => setWinRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5%</span>
              <span>60%</span>
            </div>
          </div>

          {/* Количество тендеров в месяц */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тендеров в месяц: <span className="text-blue-600 font-bold">{tendersPerMonth}</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={tendersPerMonth}
              onChange={(e) => setTendersPerMonth(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Маржинальность */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Маржинальность: <span className="text-blue-600 font-bold">{marginPercent}%</span>
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>
        </div>

        {/* Результаты */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-5 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {avgWinRateWithAI}%
            </div>
            <div className="text-xs text-gray-600">
              Процент побед с AI
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-5 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {monthlyWins}
            </div>
            <div className="text-xs text-gray-600">
              Побед в месяц
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-5 text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {monthlyRevenue.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-gray-600">
              Оборот в месяц
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-5 text-center text-white">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold mb-1">
              {netProfit.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-white/80">
              Чистая прибыль/мес
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-2 bg-gray-100 rounded-full px-6 py-3">
            <span className="text-sm text-gray-600">ROI на тарифе "Бизнес" (35 000 ₽/мес):</span>
            <span className={`text-lg font-bold ${roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roi > 0 ? '+' : ''}{roi}%
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
