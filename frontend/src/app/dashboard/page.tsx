"use client";

import { useEffect, useState } from "react";
import { TrendingUp, FileText, Trophy, AlertCircle, Bot, Search, ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface DashboardStats {
  total_tenders: number;
  my_applications: number;
  won_count: number;
  win_rate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // ✅ ИСПРАВЛЕНО: деструктурируем ровно столько, сколько возвращает Promise.all
      const [tendersResp, decisionsResp] = await Promise.all([
        api.get("/tenders/count"),
        api.get("/decisions/stats"),
      ]);

      const totalDecisions = decisionsResp.data.total_decisions || 0;
      const wonCount = decisionsResp.data.won_count || 0;

      setStats({
        total_tenders: tendersResp.data.count || 0,
        my_applications: totalDecisions,
        won_count: wonCount,
        win_rate: totalDecisions > 0 ? (wonCount / totalDecisions) * 100 : 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      setStats({
        total_tenders: 0,
        my_applications: 0,
        won_count: 0,
        win_rate: 0,
      });
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
        <h1 className="text-3xl font-bold text-gray-900">Добро пожаловать!</h1>
        <p className="text-gray-500 mt-1">Ваша панель управления тендерами</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Активных тендеров"
          value={stats?.total_tenders || 0}
          color="blue"
        />
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Моих заявок"
          value={stats?.my_applications || 0}
          color="purple"
        />
        <StatCard
          icon={<Trophy className="w-6 h-6" />}
          label="Побед"
          value={stats?.won_count || 0}
          color="yellow"
        />
        <StatCard
          icon={<AlertCircle className="w-6 h-6" />}
          label="Win Rate"
          value={`${(stats?.win_rate || 0).toFixed(1)}%`}
          color="green"
        />
      </div>

      {/* Быстрые действия */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/ai-agent"
            className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <Bot className="w-8 h-8 mb-3" />
            <h3 className="font-semibold text-lg">AI-Агент</h3>
            <p className="text-sm opacity-90 mt-1">Сгенерировать заявку</p>
          </Link>

          <Link
            href="/dashboard/tenders"
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <Search className="w-8 h-8 mb-3 text-blue-500" />
            <h3 className="font-semibold text-lg">Поиск тендеров</h3>
            <p className="text-sm text-gray-500 mt-1">Найти новые закупки</p>
          </Link>

          <Link
            href="/dashboard/decisions"
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <ScrollText className="w-8 h-8 mb-3 text-purple-500" />
            <h3 className="font-semibold text-lg">Реестр решений</h3>
            <p className="text-sm text-gray-500 mt-1">Анализ результатов</p>
          </Link>
        </div>
      </div>

      {/* Последняя активность */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Последняя активность</h2>
        <div className="space-y-3">
          <ActivityItem
            icon={<Bot className="w-4 h-4" />}
            title="AI-агент готов к работе"
            description="Задайте вопрос или попросите сгенерировать заявку"
            time="Сейчас"
            color="blue"
          />
          <ActivityItem
            icon={<TrendingUp className="w-4 h-4" />}
            title="Парсеры обновляют тендеры"
            description="Автоматический сбор данных каждые 15 минут"
            time="Непрерывно"
            color="green"
          />
          <ActivityItem
            icon={<FileText className="w-4 h-4" />}
            title="Загрузите профиль компании"
            description="Перейдите в Настройки → Профиль компании для улучшения качества AI"
            time="Рекомендация"
            color="yellow"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
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

function ActivityItem({
  icon,
  title,
  description,
  time,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    yellow: "bg-yellow-100 text-yellow-600",
  };

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
    </div>
  );
}