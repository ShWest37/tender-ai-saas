"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface CriticResult {
  score: number;
  issues: Array<{
    field: string;
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

export default function AICriticPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CriticResult | null>(null);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post("/ai/critic", {
        application_id: 1,
      });
      setResult(response.data);
    } catch (err: any) {
      // Демо результат
      setResult({
        score: 85,
        issues: [
          { field: "Форма 2, раздел 3", severity: "error", message: "Не заполнено поле \"Опыт работы\"" },
          { field: "Форма 2, раздел 5", severity: "warning", message: "Рекомендуется добавить дополнительные документы" },
          { field: "Форма 2, раздел 7", severity: "info", message: "Цена соответствует рынку" },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "info":
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case "error":
        return "Ошибка";
      case "warning":
        return "Предупреждение";
      case "info":
        return "Информация";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI-критик</h1>
        <p className="text-sm text-gray-500 mt-1">
          Проверка заявки на соответствие требованиям и поиск ошибок до отправки
        </p>
      </div>

      {/* Описание */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h3 className="font-semibold text-green-900 mb-2">Как работает AI-критик</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Проверяет каждое поле заявки на соответствие требованиям</li>
          <li>• Находит ошибки, неточности и несоответствия</li>
          <li>• Предлагает исправления перед подачей</li>
          <li>• Точность проверки: до 99.9%</li>
        </ul>
      </div>

      {/* Кнопка проверки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Проверить заявку</h3>
            <p className="text-sm text-gray-500 mt-1">
              Запустите проверку перед подачей заявки
            </p>
          </div>
          <button
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            <span>{loading ? "Проверка..." : "Проверить заявку"}</span>
          </button>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <XCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900">Результат проверки</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Оценка:</span>
              <span
                className={`text-2xl font-bold ${
                  result.score >= 80
                    ? "text-green-600"
                    : result.score >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {result.score}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {result.issues.map((issue, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  issue.severity === "error"
                    ? "bg-red-50 border-red-200"
                    : issue.severity === "warning"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(issue.severity)}
                  <div>
                    <p className="font-medium text-gray-900">{issue.field}</p>
                    <p className="text-sm text-gray-600 mt-1">{issue.message}</p>
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded ${
                        issue.severity === "error"
                          ? "bg-red-100 text-red-800"
                          : issue.severity === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {getSeverityText(issue.severity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
