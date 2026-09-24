"use client";

import { useState } from "react";
import { CreditCard, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const plans = [
  {
    id: "start",
    name: "Старт",
    price: "15 000",
    description: "Для небольших компаний",
    features: ["До 3 пользователей", "20 заявок в месяц", "Email поддержка"],
  },
  {
    id: "business",
    name: "Бизнес",
    price: "35 000",
    description: "Оптимальный выбор",
    features: [
      "До 10 пользователей",
      "Безлимит заявок",
      "AI-критик",
      "Приоритетная поддержка",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "100 000",
    description: "Для тендерных агентств",
    features: [
      "Безлимит пользователей",
      "API доступ",
      "White-label",
      "Персональный менеджер",
    ],
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setError(null);
    setLoading(planId);
    try {
      const response = await api.post("/payments/create", { plan: planId });
      window.location.href = response.data.confirmation_url;
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.response?.data?.detail || "Ошибка создания платежа");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Подписка и оплата</h1>
        <p className="text-sm text-gray-500 mt-1">
          Управление вашей подпиской
        </p>
      </div>

      {/* Текущая подписка */}
      {user?.subscription_plan ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Активна подписка «{user.subscription_plan}»
            </p>
            {user.subscription_expires_at && (
              <p className="text-xs text-green-700 mt-1">
                Действует до{" "}
                {new Date(user.subscription_expires_at).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      ) : user?.demo_expires_at ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Демо-доступ</p>
            <p className="text-xs text-yellow-700 mt-1">
              Действует до{" "}
              {new Date(user.demo_expires_at).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Тарифы */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
            <p className="text-3xl font-bold text-blue-600 mb-4">
              {plan.price}{" "}
              <span className="text-sm text-gray-500 font-normal">₽/мес</span>
            </p>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start space-x-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading === plan.id}
              className="w-full py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading === plan.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Переход к оплате...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Оплатить</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Информация */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">Способы оплаты:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Банковские карты (Visa, MasterCard, МИР)</li>
          <li>СБП (Система быстрых платежей)</li>
          <li>Для ИП и самозанятых — автоматическая отправка чека в ФНС</li>
          <li>Для ООО — закрывающие документы по email</li>
        </ul>
      </div>
    </div>
  );
}