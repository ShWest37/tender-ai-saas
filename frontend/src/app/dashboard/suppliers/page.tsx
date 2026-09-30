"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface Category {
  id: string;
  label: string;
  description: string;
  is_default: boolean;
  price_source?: { name?: string; url?: string };
  delivery_source?: { name?: string; url?: string };
}

interface Comparison {
  match_percentage: number;
  matched_specs: string[];
  mismatched_specs: string[];
  warnings: string[];
  engine: string;
}

interface SupplierResult {
  offer_id: number;
  supplier: string;
  source: string;
  source_type: string;
  is_demo: boolean;
  sku: string | null;
  title: string;
  description: string | null;
  price: number | null;
  unit: string | null;
  stock: number | null;
  delivery_days: number | null;
  url: string | null;
  comparison: Comparison;
}

interface SearchResponse {
  tender: {
    id: number;
    title: string;
    platform: string | null;
    initial_price: number | null;
    region: string | null;
    submission_deadline: string | null;
  };
  tz: Record<string, any>;
  category: string;
  category_label: string;
  results: SupplierResult[];
  sources_checked: number;
  demo_catalog: boolean;
  checked_at: string;
}

interface TenderOption {
  id: number;
  title: string;
  platform: string;
}

/** Цветовая кодировка соответствия: зелёный ✅, жёлтый ⚠️, красный ❌ */
function matchTone(value: number): "green" | "yellow" | "red" {
  if (value >= 85) return "green";
  if (value >= 60) return "yellow";
  return "red";
}

const TONE_CLASSES = {
  green: {
    badge: "bg-green-100 text-green-700",
    bar: "bg-green-500",
    text: "text-green-600",
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Отличное соответствие",
  },
  yellow: {
    badge: "bg-yellow-100 text-yellow-700",
    bar: "bg-yellow-400",
    text: "text-yellow-600",
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Есть замечания",
  },
  red: {
    badge: "bg-red-100 text-red-700",
    bar: "bg-red-500",
    text: "text-red-600",
    icon: <XCircle className="w-4 h-4" />,
    label: "Красные флаги",
  },
} as const;

export default function SupplierSearchPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCategory, setDefaultCategory] = useState("it_equipment");
  const [category, setCategory] = useState("it_equipment");

  const [tenderId, setTenderId] = useState<number | null>(null);
  const [tenders, setTenders] = useState<TenderOption[]>([]);

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [useLlm, setUseLlm] = useState(true);

  // Тендер передаётся из карточки: /dashboard/suppliers?tender_id=123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get("tender_id") || "", 10);
    if (Number.isFinite(id) && id > 0) setTenderId(id);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await api.get("/suppliers/categories");
      setCategories(response.data.categories);
      setDefaultCategory(response.data.default);
      setCategory((current) => current || response.data.default);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  }, []);

  const loadTenders = useCallback(async () => {
    try {
      const response = await api.get("/tenders", { params: { page: 1, page_size: 10 } });
      setTenders(response.data);
    } catch (err) {
      console.error("Error loading tenders:", err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadTenders();
  }, [loadCategories, loadTenders]);

  const runSearch = useCallback(
    async (id: number | null = tenderId, selectedCategory: string = category) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await api.post("/suppliers/search", {
          tender_id: id,
          category: selectedCategory,
          limit: 8,
          use_llm: useLlm,
        });
        setData(response.data);
        setExpanded(null);
      } catch (err: any) {
        if (err.response?.status === 402) {
          setError("Демо-период завершён. Оформите подписку, чтобы пользоваться поиском поставщиков.");
        } else {
          setError(err.response?.data?.detail || "Не удалось выполнить поиск поставщиков");
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [tenderId, category, useLlm]
  );

  // Автопоиск при первом открытии с ?tender_id=
  useEffect(() => {
    if (tenderId && !data && !loading && !error) {
      runSearch(tenderId, category);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  const redFlags = data
    ? data.results.reduce(
        (sum, r) => sum + r.comparison.mismatched_specs.length + r.comparison.warnings.length,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/tenders"
            className="inline-flex items-center space-x-1 text-blue-500 hover:text-blue-600 text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>К списку тендеров</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <span>🔍</span>
            <span>AI-поиск поставщиков</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Сравнение ТЗ тендера с прайс-листами поставщиков: соответствие характеристикам,
            цена и сроки поставки. Красные флаги видны до подачи заявки.
          </p>
        </div>
        <button
          onClick={() => runSearch()}
          disabled={!tenderId || loading}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors self-start"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{loading ? "Ищем поставщиков..." : "Обновить результаты"}</span>
        </button>
      </div>

      {/* Выбор тендера, категории и режима */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тендер</label>
            <select
              value={tenderId ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value, 10);
                setTenderId(Number.isFinite(id) ? id : null);
                setData(null);
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Выберите тендер —</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} · {t.title.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория поставщиков</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {categories.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.is_default ? "⭐ " : ""}
                  {n.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              По умолчанию — {categories.find((n) => n.id === defaultCategory)?.label || "IT-оборудование"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Режим сравнения</label>
            <label className="flex items-center space-x-2 px-3 py-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={useLlm}
                onChange={(e) => setUseLlm(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">AI-сравнение (YandexGPT)</span>
            </label>
            <p className="text-xs text-gray-400 mt-1">
              Без ИИ работает детерминированная проверка цены и сроков
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runSearch()}
            disabled={!tenderId || loading}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 transition-shadow"
          >
            <Search className="w-4 h-4" />
            <span>Найти поставщиков по ТЗ</span>
          </button>
          {data && (
            <span className="inline-flex items-center space-x-1 text-xs text-gray-400 self-center">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Проверено {new Date(data.checked_at).toLocaleString("ru-RU")} · источников:{" "}
                {data.sources_checked}
              </span>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ТЗ тендера */}
      {data && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                  {data.tender.platform || "Площадка"}
                </span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  {data.category_label}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{data.tender.title}</h2>
            </div>
            <div className="text-right text-sm text-gray-500">
              {data.tender.initial_price && (
                <div className="font-medium text-gray-700">
                  НМЦК {data.tender.initial_price.toLocaleString("ru-RU")} ₽
                </div>
              )}
              {data.tender.submission_deadline && (
                <div className="text-xs">
                  Подача до{" "}
                  {new Date(data.tender.submission_deadline).toLocaleDateString("ru-RU")}
                </div>
              )}
            </div>
          </div>

          {Object.keys(data.tz.specs || {}).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.tz.specs).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg"
                >
                  <b>{key}:</b> {String(value)}
                </span>
              ))}
              {data.tz.quantity && (
                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                  <b>Количество:</b> {data.tz.quantity}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {data?.demo_catalog && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Подключённых прайс-листов нет — показан встроенный демо-каталог. Добавьте источники в
          разделе <b>Админ-панель → Поставщики</b> (открытые прайсы Excel/CSV или API), чтобы
          получать актуальные цены и сроки.
        </div>
      )}

      {/* Результаты */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-600">Сопоставляем ТЗ с прайс-листами поставщиков...</p>
          <p className="text-sm text-gray-400 mt-1">Цена, сроки и характеристики — по каждой позиции</p>
        </div>
      ) : data && data.results.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl">
          <PackageSearch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">Поставщики не найдены</p>
          <p className="text-sm text-gray-400 mt-1">
            Попробуйте другую категорию или подключите прайс-листы поставщиков
          </p>
        </div>
      ) : data ? (
        <>
          {/* Сводка */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Проверено позиций</p>
              <p className="text-2xl font-bold text-gray-900">{data.results.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Среднее соответствие</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(
                  data.results.reduce((s, r) => s + r.comparison.match_percentage, 0) /
                    Math.max(1, data.results.length)
                )}
                %
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Красных флагов</p>
              <p className={`text-2xl font-bold ${redFlags > 0 ? "text-red-500" : "text-green-600"}`}>
                {redFlags}
              </p>
            </div>
          </div>

          {/* Таблица сравнения */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Поставщик
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Позиция по ТЗ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Цена
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Срок
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Соответствие
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.results.map((result) => {
                    const value = Math.round(result.comparison.match_percentage);
                    const tone = TONE_CLASSES[matchTone(value)];
                    const isOpen = expanded === result.offer_id;
                    const hasFlags =
                      result.comparison.mismatched_specs.length > 0 ||
                      result.comparison.warnings.length > 0;

                    return (
                      <Fragment key={result.offer_id}>
                        <tr className="hover:bg-gray-50 align-top">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900 flex items-center space-x-1.5">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span>{result.supplier}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{result.source}</div>
                            {result.is_demo && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded">
                                демо-каталог
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{result.title}</div>
                            {result.sku && (
                              <div className="text-xs text-gray-400 mt-0.5">Арт. {result.sku}</div>
                            )}
                            {result.stock !== null && (
                              <div
                                className={`text-xs mt-0.5 ${
                                  result.stock > 0 ? "text-green-600" : "text-red-500"
                                }`}
                              >
                                {result.stock > 0 ? `в наличии: ${result.stock}` : "нет в наличии"}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {result.price !== null ? (
                              <span className="font-semibold text-gray-900">
                                {result.price.toLocaleString("ru-RU")} ₽
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                            <div className="text-xs text-gray-400">за {result.unit || "шт"}</div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {result.delivery_days !== null ? (
                              <span className="text-gray-700">{result.delivery_days} дн.</span>
                            ) : (
                              <span className="text-gray-400">не указан</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col items-center space-y-1.5">
                              <span
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-sm font-semibold ${tone.badge}`}
                              >
                                {tone.icon}
                                <span>{value}%</span>
                              </span>
                              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${tone.bar}`}
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                              <span className={`text-[11px] ${tone.text}`}>{tone.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => setExpanded(isOpen ? null : result.offer_id)}
                              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                hasFlags
                                  ? "border-yellow-200 text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span>
                                {isOpen ? "Скрыть" : "Детали"}
                                {hasFlags
                                  ? ` (${result.comparison.mismatched_specs.length + result.comparison.warnings.length})`
                                  : ""}
                              </span>
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={6} className="px-4 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* ✅ Зелёный */}
                                <div className="bg-white border border-green-200 rounded-lg p-4">
                                  <h4 className="flex items-center space-x-1.5 font-semibold text-green-700 mb-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Соответствует ТЗ</span>
                                    <span className="text-xs font-normal text-green-600">
                                      ({result.comparison.matched_specs.length})
                                    </span>
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {result.comparison.matched_specs.length === 0 && (
                                      <li className="text-sm text-gray-400">Нет подтверждений</li>
                                    )}
                                    {result.comparison.matched_specs.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start space-x-1.5 text-sm text-gray-700"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* ❌ Красный */}
                                <div className="bg-white border border-red-200 rounded-lg p-4">
                                  <h4 className="flex items-center space-x-1.5 font-semibold text-red-700 mb-2">
                                    <XCircle className="w-4 h-4" />
                                    <span>Не соответствует</span>
                                    <span className="text-xs font-normal text-red-600">
                                      ({result.comparison.mismatched_specs.length})
                                    </span>
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {result.comparison.mismatched_specs.length === 0 && (
                                      <li className="text-sm text-gray-400">Расхождений нет</li>
                                    )}
                                    {result.comparison.mismatched_specs.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start space-x-1.5 text-sm text-gray-700"
                                      >
                                        <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* ⚠️ Жёлтый */}
                                <div className="bg-white border border-yellow-200 rounded-lg p-4">
                                  <h4 className="flex items-center space-x-1.5 font-semibold text-yellow-700 mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Предупреждения</span>
                                    <span className="text-xs font-normal text-yellow-600">
                                      ({result.comparison.warnings.length})
                                    </span>
                                  </h4>
                                  <ul className="space-y-1.5">
                                    {result.comparison.warnings.length === 0 && (
                                      <li className="text-sm text-gray-400">Предупреждений нет</li>
                                    )}
                                    {result.comparison.warnings.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start space-x-1.5 text-sm text-gray-700"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                                <span>
                                  Движок сравнения:{" "}
                                  {result.comparison.engine === "yandex_gpt"
                                    ? "YandexGPT"
                                    : "детерминированные проверки"}
                                </span>
                                {result.url && (
                                  <a
                                    href={result.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-600"
                                  >
                                    Открыть позицию у поставщика →
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-14 bg-white rounded-xl border border-dashed border-gray-200">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            Выберите тендер и нажмите «Найти поставщиков по ТЗ»
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Кнопка также доступна в карточке тендера в разделе «Тендеры»
          </p>
        </div>
      )}
    </div>
  );
}
