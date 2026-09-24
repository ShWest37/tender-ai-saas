"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Trophy, Target, Award, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Stats {
  total_decisions: number;
  admitted_count: number;
  rejected_count: number;
  won_count: number;
  lost_count: number;
  average_place: number | null;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get("/decisions/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const winRate = stats && stats.total_decisions > 0
    ? (stats.won_count / stats.total_decisions) * 100
    : 0;

  const admissionRate = stats && stats.total_decisions > 0
    ? (stats.admitted_count / stats.total_decisions) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <p className="text-sm text-gray-500 mt-1">
          Статистика ваших побед и поражений
        </p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Trophy className="w-6 h-6" />}
          label="Побед"
          value={stats?.won_count || 0}
          color="yellow"
        />
        <MetricCard
          icon={<Target className="w-6 h-6" />}
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color="green"
        />
        <MetricCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Среднее место"
          value={stats?.average_place?.toFixed(1) || "—"}
          color="blue"
        />
        <MetricCard
          icon={<Award className="w-6 h-6" />}
          label="Допуск заявок"
          value={`${admissionRate.toFixed(1)}%`}
          color="purple"
        />
      </div>

      {/* Детальная статистика */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Детализация
        </h2>
        <div className="space-y-3">
          <StatRow label="Всего решений" value={stats?.total_decisions || 0} />
          <StatRow label="Допущено к участию" value={stats?.admitted_count || 0} color="green" />
          <StatRow label="Отклонено модераторами" value={stats?.rejected_count || 0} color="red" />
          <StatRow label="Побед" value={stats?.won_count || 0} color="yellow" />
          <StatRow label="Поражений" value={stats?.lost_count || 0} color="red" />
        </div>
      </div>

      {/* Рекомендации */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-lg font-semibold mb-3">💡 Рекомендации AI</h2>
        {stats && stats.total_decisions > 0 ? (
          <ul className="space-y-2 text-sm">
            {stats.rejected_count > stats.total_decisions * 0.1 && (
              <li>
                • У вас {(stats.rejected_count / stats.total_decisions * 100).toFixed(0)}% заявок отклоняются. Проверьте заполнение Формы 2.
              </li>
            )}
            {winRate < 20 && (
              <li>
                • Win Rate ниже среднего. Попробуйте участвовать в тендерах с меньшей конкуренцией.
              </li>
            )}
            {stats.average_place && stats.average_place > 3 && (
              <li>
                • Среднее место {stats.average_place.toFixed(1)}. Рассмотрите снижение цены на 5-10%.
              </li>
            )}
            {winRate >= 20 && stats.rejected_count === 0 && (
              <li>
                • Отличные показатели! Продолжайте в том же духе.
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm opacity-90">
            Подайте первые заявки, чтобы получить персональные рекомендации.
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
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

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    green: "text-green-600",
    red: "text-red-600",
    yellow: "text-yellow-600",
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-lg font-semibold ${color ? colors[color] : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}