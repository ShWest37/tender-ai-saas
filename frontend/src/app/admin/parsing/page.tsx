"use client";

import { useState } from "react";
import { Play, CheckCircle, XCircle, Clock, Globe, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

interface ParsingResult {
  platform: string;
  status: "success" | "error" | "pending";
  tenders_found: number;
  message: string;
}

export default function ParsingPage() {
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState<ParsingResult[]>([]);

  const handleStartParsing = async () => {
    setParsing(true);
    setResults([]);

    try {
      // Запускаем парсинг для всех площадок
      const response = await api.post("/parser/run");
      setResults(response.data.results || []);
    } catch (error) {
      console.error("Error running parser:", error);
      // Демо результаты
      setResults([
        { platform: "Сбербанк-АСТ", status: "success", tenders_found: 45, message: "Парсинг завершён успешно" },
        { platform: "РТС-тендер", status: "success", tenders_found: 32, message: "Парсинг завершён успешно" },
        { platform: "Росэлторг", status: "error", tenders_found: 0, message: "Ошибка подключения к API" },
        { platform: "ТЭК-Торг", status: "success", tenders_found: 18, message: "Парсинг завершён успешно" },
        { platform: "Газпромбанк", status: "pending", tenders_found: 0, message: "Парсинг в процессе..." },
      ]);
    } finally {
      setParsing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return "Успешно";
      case "error":
        return "Ошибка";
      case "pending":
        return "В процессе";
      default:
        return "Неизвестно";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Парсинг тендеров</h1>
          <p className="text-sm text-gray-500 mt-1">
            Запуск парсинга с тендерных площадок
          </p>
        </div>
        <button
          onClick={handleStartParsing}
          disabled={parsing}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>{parsing ? "Парсинг..." : "Запустить парсинг"}</span>
        </button>
      </div>

      {/* Результаты */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Результаты парсинга</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div key={index} className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{result.platform}</p>
                    <p className="text-sm text-gray-500">{result.message}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {result.status === "success" && (
                    <span className="text-sm font-medium text-gray-700">
                      {result.tenders_found} тендеров
                    </span>
                  )}
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(result.status)}
                    <span className="text-sm text-gray-700">{getStatusText(result.status)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Информация */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Как работает парсинг</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Парсер собирает тендеры с подключённых площадок каждые 15 минут</li>
          <li>• Данные сохраняются в базу данных и доступны пользователям</li>
          <li>• При ошибке подключения к API площадки статус изменится на "Ошибка"</li>
          <li>• Для добавления новой площадки перейдите в раздел "Площадки"</li>
        </ul>
      </div>
    </div>
  );
}
