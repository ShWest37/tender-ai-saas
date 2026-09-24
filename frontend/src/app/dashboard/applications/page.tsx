"use client";

import { useState, useEffect } from "react";
import { FileText, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Application {
  id: number;
  tender_id: number;
  status: string;
  ai_confidence_score: number | null;
  submitted_at: string | null;
  result_price: number | null;
  created_at: string;
  tender?: {
    id: number;
    title: string;
    platform: string;
    initial_price: number | null;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Черновик", color: "bg-gray-100 text-gray-700", icon: Clock },
  ai_generated: { label: "AI сгенерировал", color: "bg-blue-100 text-blue-700", icon: FileText },
  reviewed: { label: "Проверено", color: "bg-purple-100 text-purple-700", icon: CheckCircle },
  submitted: { label: "Отправлено", color: "bg-green-100 text-green-700", icon: CheckCircle },
  won: { label: "Победа", color: "bg-yellow-100 text-yellow-700", icon: CheckCircle },
  lost: { label: "Поражение", color: "bg-red-100 text-red-700", icon: XCircle },
  rejected: { label: "Отклонено", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const response = await api.get("/applications");
      setApplications(response.data);
    } catch (error) {
      console.error("Error loading applications:", error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Мои заявки</h1>
        <p className="text-sm text-gray-500 mt-1">
          Все ваши поданные и подготовленные заявки
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">У вас пока нет заявок</p>
          <Link
            href="/dashboard/tenders"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Найти тендер
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Тендер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  AI-оценка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Дата
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applications.map((app) => {
                const status = statusConfig[app.status] || statusConfig.draft;
                const Icon = status.icon;
                return (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 line-clamp-1">
                        {app.tender?.title || `Тендер #${app.tender_id}`}
                      </p>
                      {app.tender?.platform && (
                        <p className="text-xs text-gray-500 mt-1">
                          {app.tender.platform}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <Icon className="w-3 h-3" />
                        <span>{status.label}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {app.ai_confidence_score != null ? (
                        <span className="text-sm font-medium text-gray-900">
                          {(app.ai_confidence_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(app.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/ai-agent?application_id=${app.id}`}
                        className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                      >
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}