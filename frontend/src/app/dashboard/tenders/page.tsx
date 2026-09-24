"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Calendar, DollarSign, MapPin, Building, Loader2 } from "lucide-react";
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

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lawType, setLawType] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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
      if (region) params.region = region;

      const [tendersResp, countResp] = await Promise.all([
        api.get("/tenders", { params }),
        api.get("/tenders/count", { params }),
      ]);
      setTenders(tendersResp.data);
      setTotalCount(countResp.data.count || 0);
    } catch (error) {
      console.error("Error loading tenders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadTenders();
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
                        <span>
                          До {new Date(tender.submission_deadline).toLocaleDateString("ru-RU")}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/dashboard/ai-agent?tender_id=${tender.id}`}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-shadow flex-shrink-0"
                >
                  AI-анализ
                </Link>
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