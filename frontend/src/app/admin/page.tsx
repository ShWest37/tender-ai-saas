"use client";

import { useState, useEffect } from "react";
import { Users, CreditCard, Globe, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface AdminStats {
  total_users: number;
  active_subscriptions: number;
  total_revenue: number;
  active_platforms: number;
  pending_support: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Загружаем статистику
      setStats({
        total_users: 156,
        active_subscriptions: 89,
        total_revenue: 3115000,
        active_platforms: 8,
        pending_support: 12,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Админ-панель</h1>
        <p className="text-gray-500 mt-1">Управление сайтом и мониторинг</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Пользователей"
          value={stats?.total_users || 0}
          color="blue"
        />
        <StatCard
          icon={<CreditCard className="w-6 h-6" />}
          label="Активных подписок"
          value={stats?.active_subscriptions || 0}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Доход"
          value={`${(stats?.total_revenue || 0).toLocaleString("ru-RU")} ₽`}
          color="purple"
        />
        <StatCard
          icon={<Globe className="w-6 h-6" />}
          label="Площадок"
          value={stats?.active_platforms || 0}
          color="orange"
        />
      </div>

      {/* Быстрые действия */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/parsing"
            className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <Activity className="w-8 h-8 mb-3" />
            <h3 className="font-semibold text-lg">Запустить парсинг</h3>
            <p className="text-sm opacity-90 mt-1">Собрать тендеры с площадок</p>
          </a>

          <a
            href="/admin/platforms"
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <Globe className="w-8 h-8 mb-3 text-blue-500" />
            <h3 className="font-semibold text-lg">Добавить площадку</h3>
            <p className="text-sm text-gray-500 mt-1">Вручную через API</p>
          </a>

          <a
            href="/admin/support"
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <AlertCircle className="w-8 h-8 mb-3 text-red-500" />
            <h3 className="font-semibold text-lg">Обращения</h3>
            <p className="text-sm text-gray-500 mt-1">{stats?.pending_support || 0} новых</p>
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className={`w-12 h-12 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
