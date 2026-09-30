"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Calendar, DollarSign, MapPin, Building, Loader2, Play } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Tender {
  id: number;
  external_id: string;
  platform: string;
  title: string;
  law_type: string | null;
  initial_price: number | null;
  region: string | null;
  customer_name: string | null;
  submission_deadline: string | null;
  status: string;
}

// Демо данные для тендеров
const demoTenders: Tender[] = [
  {
    id: 1,
    external_id: "T-001",
    platform: "Сбербанк-АСТ",
    title: "Поставка оборудования для лаборатории",
    law_type: "44-FZ",
    initial_price: 2500000,
    region: "Москва",
    customer_name: "ГБУ «Научный центр»",
    submission_deadline: "2026-10-15",
    status: "ACTIVE",
  },
  {
    id: 2,
    external_id: "T-002",
    platform: "РТС-тендер",
    title: "Ремонт здания администрации",
    law_type: "44-FZ",
    initial_price: 4800000,
    region: "Санкт-Петербург",
    customer_name: "Администрация района",
    submission_deadline: "2026-10-20",
    status: "ACTIVE",
  },
  {
    id: 3,
    external_id: "T-003",
    platform: "Росэлторг",
    title: "Поставка мебели для школы",
    law_type: "223-FZ",
    initial_price: 1200000,
    region: "Казань",
    customer_name: "Школа №45",
    submission_deadline: "2026-10-10",
    status: "ACTIVE",
  },
  {
    id: 4,
    external_id: "T-004",
    platform: "ТЭК-Торг",
    title: "Техническое обслуживание транспорта",
    law_type: "44-FZ",
    initial_price: 800000,
    region: "Новосибирск",
    customer_name: "Автопарк «Транс»",
    submission_deadline: "2026-10-25",
    status: "ACTIVE",
  },
  {
    id: 5,
    external_id: "T-005",
    platform: "Газпромбанк",
    title: "Поставка продуктов питания",
    law_type: "223-FZ",
    initial_price: 3500000,
    region: "Екатеринбург",
    customer_name: "Ресторан «Вкус»",
    submission_deadline: "2026-10-12",
    status: "ACTIVE",
  },
  {
    id: 6,
    external_id: "T-006",
    platform: "ЕЭТП",
    title: "Разработка программного обеспечения",
    law_type: "44-FZ",
    initial_price: 5600000,
    region: "Москва",
    customer_name: "Министерство цифрового развития",
    submission_deadline: "2026-10-30",
    status: "ACTIVE",
  },
];

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lawType, setLawType] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isDemo, setIsDemo] = useState(false);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadTenders();
  }, [page, lawType]);

  const loadTenders = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: PAGE_SIZE };
      if (searchQuery) params.query = searchQuery;
      if (lawType) params.law_type = lawType;

      const [tendersResp, countResp] = await Promise.all([
        api.get("/tenders", { params }),
        api.get("/tenders/count", { params }),
      ]);
      setTenders(tendersResp.data);
      setTotalCount(countResp.data.count || 0);
      setIsDemo(false);
    } catch (error) {
      console.error("Error loading tenders:", error);
      // Демо данные при ошибке
      setTenders(demoTenders);
      setTotalCount(demoTenders.length);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadTenders();
  };

  const handleLoadDemo = () => {
    setTenders(demoTenders);
    setTotalCount(demoTenders.length);
    setIsDemo(true);
    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Поиск тендеров</h1>
        <p className="text-sm text-gray-500 mt-1">
          Найдено {totalCount.toLocaleString("ru-RU")} активных закупок
        </p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Поиск по названию, описанию..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={lawType}
            onChange={(e) => {
              setLawType(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все законы</option>
            <option value="44-FZ">ФЗ-44</option>
            <option value="223-FZ">ФЗ-223</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Найти</span>
          </button>
        </div>
      </div>

      {/* Демо кнопка */}
      <div className="flex justify-end">
        <button
          onClick={handleLoadDemo}
          className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>Загрузить демо-данные</span>
        </button>
      </div>

      {/* Список тендеров */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tenders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Тендеры не найдены</p>
          <p className="text-sm text-gray-400 mt-1">Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <div className="space-y-4">
          {isDemo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              Показаны демо-данные. Для получения реальных тендеров подключите API площадок.
            </div>
          )}
          {tenders.map((tender) => (
            <div
              key={tender.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {tender.platform}
                    </span>
                    {tender.law_type && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        {tender.law_type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
                    {tender.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {tender.customer_name && (
                      <span className="flex items-center space-x-1">
                        <Building className="w-4 h-4" />
                        <span className="truncate max-w-xs">{tender.customer_name}</span>
                      </span>
                    )}
                    {tender.region && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{tender.region}</span>
                      </span>
                    )}
                    {tender.initial_price && (
                      <span className="flex items-center space-x-1 font-medium text-gray-700">
                        <DollarSign className="w-4 h-4" />
                        <span>{tender.initial_price.toLocaleString("ru-RU")} ₽</span>
                      </span>
                    )}
                    {tender.submission_deadline && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>До {new Date(tender.submission_deadline).toLocaleDateString("ru-RU")}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/dashboard/suppliers?tender_id=${tender.id}`}
                    className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1.5 text-center"
                    title="AI-поиск поставщиков с проверкой соответствия ТЗ, цене и срокам"
                  >
                    <span>🔍</span>
                    <span>Найти поставщиков по этому ТЗ</span>
                  </Link>
                  <Link
                    href={`/dashboard/ai-agent?tender_id=${tender.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-shadow flex-shrink-0 text-center"
                  >
                    AI-анализ
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 bg-white rounded-lg p-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            ← Назад
          </button>
          <span className="text-sm text-gray-600 px-4">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
