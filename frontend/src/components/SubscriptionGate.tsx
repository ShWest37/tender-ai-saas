"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, CreditCard, Loader2, Lock } from "lucide-react";
import { api } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
}

const PLANS: Plan[] = [
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
    features: ["До 10 пользователей", "Безлимит заявок", "AI-критик", "Приоритетная поддержка"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "100 000",
    description: "Для тендерных агентств",
    features: ["Безлимит пользователей", "API доступ", "White-label", "Персональный менеджер"],
  },
];

const EXPIRED_EVENT = "subscription:expired";

/**
 * Блокировка функционала по окончании демо-периода / подписки.
 *
 * Проверяет /auth/me и подписывается на событие 402 из api-интерсептора.
 * Если доступа нет — накрывает кабинет модальным окном с тарифами,
 * чтобы пользователь сразу увидел, как продлить работу.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(EXPIRED_EVENT, onExpired);
    checkAccess();
    return () => window.removeEventListener(EXPIRED_EVENT, onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAccess = async () => {
    if (typeof window === "undefined" || !localStorage.getItem("access_token")) {
      setChecking(false);
      return;
    }
    try {
      const response = await api.get("/auth/me");
      const user = response.data;
      const now = Date.now();
      const hasSubscription =
        user.subscription_plan &&
        user.subscription_expires_at &&
        new Date(user.subscription_expires_at).getTime() > now;
      const hasDemo =
        user.demo_expires_at && new Date(user.demo_expires_at).getTime() > now;

      if (user.subscription_plan) setPlanName(user.subscription_plan);
      // Администратору кабинет доступен всегда (он управляет системой)
      if (user.role === "admin") return;
      if (!hasSubscription && !hasDemo) setExpired(true);
    } catch {
      // 401 обработан интерсептором — здесь ничего не делаем
    } finally {
      setChecking(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setError(null);
    setLoading(planId);
    try {
      const response = await api.post("/payments/create", { plan: planId });
      window.location.href = response.data.confirmation_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || "Ошибка создания платежа");
      setLoading(null);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!expired) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="bg-white rounded-2xl shadow-xl border border-yellow-200 p-6 sm:p-10">
          <div className="flex items-start space-x-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {planName
                  ? "Срок подписки истёк"
                  : "Демо-доступ на 3 дня завершён"}
              </h1>
              <p className="text-gray-600 mt-2">
                Функционал кабинета приостановлен: поиск тендеров, AI-генерация заявок,
                AI-критик и поиск поставщиков доступны только по подписке.
                Выберите подходящий тариф, чтобы продолжить работу.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Ваши данные и заявки сохранены — после оплаты доступ откроется сразу.</span>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className="border border-gray-200 rounded-xl p-5 flex flex-col hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {plan.id === "business" && (
                    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      Популярный
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                <p className="text-2xl font-bold text-blue-600 mb-4">
                  {plan.price} <span className="text-sm font-normal text-gray-500">₽/мес</span>
                </p>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                  className="w-full py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
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

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <a
              href="/dashboard/billing"
              className="text-sm font-medium text-blue-500 hover:text-blue-600"
            >
              Подробнее о тарифах и способах оплаты →
            </a>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem("access_token");
                  localStorage.removeItem("refresh_token");
                } catch {
                  // ignore
                }
                window.location.href = "/auth/login?logout=1";
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Выйти из кабинета
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
