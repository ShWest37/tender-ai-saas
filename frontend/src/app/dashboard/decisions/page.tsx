"use client";

import { useState } from "react";
import { ScrollText, Trophy, XCircle, Clock, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Decision {
  id: number;
  tender_title: string;
  status: "won" | "lost" | "pending" | "rejected";
  place?: number;
  total_participants?: number;
  winner_price?: number;
  decision_date: string;
}

export default function DecisionsPage() {
  const [decisions] = useState<Decision[]>([
    {
      id: 1,
      tender_title: "Поставка оборудования для лаборатории",
      status: "won",
      place: 1,
      total_participants: 5,
      winner_price: 2500000,
      decision_date: "2026-09-20",
    },
    {
      id: 2,
      tender_title: "Ремонт здания администрации",
      status: "lost",
      place: 3,
      total_participants: 8,
      winner_price: 4800000,
      decision_date: "2026-09-18",
    },
    {
      id: 3,
      tender_title: "Поставка мебели для школы",
      status: "pending",
      decision_date: "2026-09-25",
    },
    {
      id: 4,
      tender_title: "Техническое обслуживание транспорта",
      status: "rejected",
      decision_date: "2026-09-15",
    },
    {
      id: 5,
      tender_title: "Поставка продуктов питания",
      status: "won",
      place: 1,
      total_participants: 3,
      winner_price: 1200000,
      decision_date: "2026-09-10",
    },
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "won":
        return <Trophy className="w-5 h-5 text-green-500" />;
      case "lost":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "won":
        return "Победа";
      case "lost":
        return "Поражение";
      case "pending":
        return "Ожидание";
      case "rejected":
        return "Отклонено";
      default:
        return "";
    }
  };

  const wonCount = decisions.filter((d) => d.status === "won").length;
  const lostCount = decisions.filter((d) => d.status === "lost").length;
  const pendingCount = decisions.filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Реестр решений</h1>
        <p className="text-sm text-gray-500 mt-1">
          История результатов тендеров и аналитика побед/поражений
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
            <Trophy className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Победы</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{wonCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mb-3">
            <XCircle className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Поражения</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{lostCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Ожидание</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
            <ScrollText className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-500">Всего</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{decisions.length}</p>
        </div>
      </div>

      {/* Список решений */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Все решения</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {decisions.map((decision) => (
            <div key={decision.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start space-x-4">
                  {getStatusIcon(decision.status)}
                  <div>
                    <h4 className="font-medium text-gray-900">{decision.tender_title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{new Date(decision.decision_date).toLocaleDateString("ru-RU")}</span>
                      {decision.place && (
                        <span>
                          Место: {decision.place} из {decision.total_participants}
                        </span>
                      )}
                      {decision.winner_price && (
                        <span>Цена: {decision.winner_price.toLocaleString("ru-RU")} ₽</span>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${
                    decision.status === "won"
                      ? "bg-green-100 text-green-800"
                      : decision.status === "lost"
                      ? "bg-red-100 text-red-800"
                      : decision.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {getStatusText(decision.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
