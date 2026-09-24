"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { RegisterModal } from "@/components/modals/RegisterModal";

const plans = [
  {
    name: "Старт",
    price: 15000,
    planId: "start",
    description: "Для небольших компаний",
    features: [
      "До 3 пользователей",
      "Поиск по всем ЕТП",
      "Базовая AI-генерация",
      "До 20 заявок в месяц",
      "Email поддержка",
    ],
    popular: false,
  },
  {
    name: "Бизнес",
    price: 35000,
    planId: "business",
    description: "Оптимальный выбор",
    features: [
      "До 10 пользователей",
      "Все площадки + API",
      "Полная AI-генерация",
      "Безлимитные заявки",
      "AI-критик",
      "Аналитика Win/Loss",
      "Приоритетная поддержка",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 100000,
    planId: "enterprise",
    description: "Для тендерных агентств",
    features: [
      "Безлимит пользователей",
      "White-label",
      "Выделенный AI",
      "API доступ",
      "Персональный менеджер",
      "SLA 99.9%",
      "Обучение команды",
    ],
    popular: false,
  },
];

export function PricingCards() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChoosePlan = async (planName: string, planId: string) => {
    setError(null);
    const token = localStorage.getItem("access_token");

    // Если не авторизован — открываем регистрацию
    if (!token) {
      setShowRegister(true);
      return;
    }

    setLoadingPlan(planName);
    try {
      const response = await api.post("/payments/create", { plan: planId });
      // Перенаправляем на страницу оплаты YooKassa
      window.location.href = response.data.confirmation_url;
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(
        err.response?.data?.detail || "Ошибка создания платежа. Попробуйте позже."
      );
      setLoadingPlan(null);
    }
  };

  return (
    <>
      <div>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Тарифы <span className="gradient-text">подписки</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Выберите подходящий план
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm max-w-md mx-auto">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-2xl p-8 ${
                plan.popular
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-2xl md:scale-105"
                  : "bg-white border border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="inline-block px-4 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
                  Популярный
                </div>
              )}

              <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-6 ${plan.popular ? "text-white/80" : "text-gray-600"}`}>
                {plan.description}
              </p>

              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.popular ? "text-white" : "text-gray-900"}`}>
                  {plan.price.toLocaleString("ru-RU")}
                </span>
                <span className={plan.popular ? "text-white/80" : "text-gray-600"}> ₽/мес</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start space-x-3">
                    <Check className={`w-5 h-5 flex-shrink-0 ${plan.popular ? "text-white" : "text-green-500"}`} />
                    <span className={plan.popular ? "text-white/90" : "text-gray-600"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChoosePlan(plan.name, plan.planId)}
                disabled={loadingPlan === plan.name}
                className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
                  plan.popular
                    ? "bg-white text-blue-600 hover:bg-gray-100"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                } disabled:opacity-50`}
              >
                {loadingPlan === plan.name ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span>Переход к оплате...</span>
                  </>
                ) : (
                  "Выбрать тариф"
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        onOpenLogin={() => {
          setShowRegister(false);
          window.location.href = "/auth/login";
        }}
      />
    </>
  );
}