"use client";

import { useState } from "react";
import { Zap, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function AIGenerationPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post("/ai/generate", {
        tender_id: 1,
        company_profile: {},
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI-генерация заявок</h1>
        <p className="text-sm text-gray-500 mt-1">
          Автоматическое заполнение Формы 2 с помощью искусственного интеллекта
        </p>
      </div>

      {/* Описание */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Как это работает</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• AI анализирует документацию тендера</li>
          <li>• Заполняет все поля Формы 2 на основе профиля компании</li>
          <li>• Проверяет на ошибки и готовит к подаче</li>
          <li>• Время генерации: 3-5 минут</li>
        </ul>
      </div>

      {/* Кнопка генерации */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Сгенерировать заявку</h3>
            <p className="text-sm text-gray-500 mt-1">
              Выберите тендер и нажмите кнопку для генерации
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            <span>{loading ? "Генерация..." : "Сгенерировать"}</span>
          </button>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Заявка сгенерирована</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
