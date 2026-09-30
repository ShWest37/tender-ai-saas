"use client";

import { useState, useEffect } from "react";
import { Plus, Play, CheckCircle, XCircle, Clock, Globe, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface Platform {
  id: number;
  platform_name: string;
  is_active: boolean;
  api_url: string;
  last_run_at: string | null;
  last_error: string | null;
  status: "active" | "inactive" | "error" | "pending";
}

const defaultPlatforms = [
  { name: "Сбербанк-АСТ", url: "https://sberbank-ast.ru" },
  { name: "РТС-тендер", url: "https://rts-tender.ru" },
  { name: "Росэлторг", url: "https://roseltorg.ru" },
  { name: "ТЭК-Торг", url: "https://tek-torg.ru" },
  { name: "Газпромбанк", url: "https://gazprombank.ru" },
  { name: "НЭП", url: "https://nep.ru" },
  { name: "ЕЭТП", url: "https://eetp.ru" },
  { name: "АГЗ РТ", url: "https://agzrt.ru" },
];

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ name: "", url: "", api_key: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    setLoading(true);
    try {
      const response = await api.get("/parser/configs");
      setPlatforms(response.data);
    } catch (error) {
      console.error("Error loading platforms:", error);
      // Демо данные
      setPlatforms(
        defaultPlatforms.map((p, i) => ({
          id: i + 1,
          platform_name: p.name,
          is_active: true,
          api_url: p.url,
          last_run_at: new Date().toISOString(),
          last_error: null,
          status: "active" as const,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlatform = async () => {
    setAdding(true);
    try {
      await api.post("/parser/configs", {
        platform_name: newPlatform.name,
        api_url: newPlatform.url,
        api_key: newPlatform.api_key,
        is_active: true,
      });
      setShowAddForm(false);
      setNewPlatform({ name: "", url: "", api_key: "" });
      loadPlatforms();
    } catch (error) {
      console.error("Error adding platform:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePlatform = async (id: number) => {
    if (!confirm("Удалить эту площадку?")) return;
    try {
      await api.delete(`/parser/configs/${id}`);
      loadPlatforms();
    } catch (error) {
      console.error("Error deleting platform:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Активна";
      case "error":
        return "Ошибка";
      case "pending":
        return "Ожидание";
      default:
        return "Неактивна";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Площадки</h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление тендерными площадками и API
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить площадку</span>
        </button>
      </div>

      {/* Форма добавления */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Новая площадка</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={newPlatform.name}
                onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
                placeholder="Название площадки"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
              <input
                type="text"
                value={newPlatform.url}
                onChange={(e) => setNewPlatform({ ...newPlatform, url: e.target.value })}
                placeholder="https://api.platform.ru"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">API ключ</label>
              <input
                type="text"
                value={newPlatform.api_key}
                onChange={(e) => setNewPlatform({ ...newPlatform, api_key: e.target.value })}
                placeholder="API ключ для доступа"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={handleAddPlatform}
              disabled={adding || !newPlatform.name || !newPlatform.url}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {adding ? "Добавление..." : "Добавить"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список площадок */}
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
                    Площадка
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Последний запуск
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {platforms.map((platform) => (
                  <tr key={platform.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">{platform.platform_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {platform.api_url}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(platform.status)}
                        <span className="text-sm text-gray-700">{getStatusText(platform.status)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {platform.last_run_at
                        ? new Date(platform.last_run_at).toLocaleString("ru-RU")
                        : "Никогда"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDeletePlatform(platform.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
