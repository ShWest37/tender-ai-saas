"use client";

import { useState, useEffect } from "react";
import { CreditCard, Users, TrendingUp, Calendar } from "lucide-react";
import { api } from "@/lib/api";

interface Subscription {
  id: number;
  user_email: string;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await api.get("/payments/subscriptions");
      setSubscriptions(response.data);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
      // Демо данные
      setSubscriptions([
        { id: 1, user_email: "user1@example.com", plan: "Бизнес", amount: 35000, status: "active", created_at: "2026-09-01", expires_at: "2026-10-01" },
        { id: 2, user_email: "user2@example.com", plan: "Старт", amount: 15000, status: "active", created_at: "2026-09-15", expires_at: "2026-10-15" },
        { id: 3, user_email: "user3@example.com", plan: "Enterprise", amount: 100000, status: "active", created_at: "2026-08-20", expires_at: "2026-09-20" },
        { id: 4, user_email: "user4@example.com", plan: "Бизнес", amount: 35000, status: "expired", created_at: "2026-08-01", expires_at: "2026-09-01" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.amount, 0);

  const activeCount = subscriptions.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Подписки</h1>
        <p className="text-sm text-gray-500 mt-1">
          Статистика оплаченных подписок пользователей
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Активных подписок</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Общий доход</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalRevenue.toLocaleString("ru-RU")} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
            <CreditCard className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Средний чек</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {activeCount > 0 ? Math.round(totalRevenue / activeCount).toLocaleString("ru-RU") : 0} ₽
          </p>
        </div>
      </div>

      {/* Таблица подписок */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пользователь
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Тариф
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата окончания
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sub.user_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sub.amount.toLocaleString("ru-RU")} ₽
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          sub.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {sub.status === "active" ? "Активна" : "Истекла"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(sub.expires_at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
