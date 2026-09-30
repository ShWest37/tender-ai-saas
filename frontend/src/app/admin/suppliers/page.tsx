"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface Source {
  id: number;
  slug: string;
  name: string;
  supplier_name: string | null;
  source_type: string;
  category: string | null;
  category_label: string | null;
  website: string | null;
  price_list_url: string | null;
  api_url: string | null;
  default_delivery_days: number | null;
  is_active: boolean;
  offers_count: number;
  last_sync_at: string | null;
  last_error: string | null;
}

interface Category {
  id: string;
  label: string;
  description: string;
  is_default: boolean;
  price_source?: { name?: string; url?: string };
  delivery_source?: { name?: string; url?: string };
}

const SOURCE_TYPES = [
  { value: "csv", label: "CSV (открытый прайс-лист)" },
  { value: "xlsx", label: "Excel / XLSX (открытый прайс-лист)" },
  { value: "json", label: "JSON (открытый прайс-лист)" },
  { value: "api", label: "API агрегатора (JSON)" },
  { value: "demo", label: "Демо-каталог (без сети)" },
];

const TYPE_LABELS: Record<string, string> = {
  csv: "CSV",
  xlsx: "Excel",
  json: "JSON",
  api: "API",
  demo: "Демо",
};

export default function AdminSuppliersPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    supplier_name: "",
    source_type: "csv",
    category: "it_equipment",
    price_list_url: "",
    api_url: "",
    default_delivery_days: 3,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sourcesResp, categoriesResp] = await Promise.all([
        api.get("/suppliers/sources"),
        api.get("/suppliers/categories"),
      ]);
      setSources(sourcesResp.data);
      setCategories(categoriesResp.data.categories);
    } catch (error) {
      console.error("Error loading supplier sources:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAddPresets = async () => {
    try {
      await api.post("/suppliers/sources/presets");
      await loadAll();
      showNotice("Пресеты B2B-дистрибьюторов добавлены (Ситилинк, Комус)");
    } catch (error: any) {
      showNotice(error.response?.data?.detail || "Не удалось добавить пресеты");
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post("/suppliers/sources", {
        ...form,
        supplier_name: form.supplier_name || form.name,
        price_list_url: form.price_list_url || null,
        api_url: form.api_url || null,
      });
      setShowForm(false);
      setForm({ ...form, name: "", supplier_name: "", price_list_url: "", api_url: "" });
      await loadAll();
      showNotice("Источник прайс-листа добавлен");
    } catch (error: any) {
      showNotice(error.response?.data?.detail || "Не удалось добавить источник");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (source: Source) => {
    setSyncing(source.id);
    try {
      const response = await api.post(`/suppliers/sources/${source.id}/sync`);
      const result = response.data;
      showNotice(
        result.mode === "remote"
          ? `«${source.name}»: загружено позиций — ${result.imported}`
          : `«${source.name}»: прайс недоступен, подставлен демо-каталог (${result.imported} поз.)${
              result.error ? ` · ${result.error}` : ""
            }`
      );
      await loadAll();
    } catch (error: any) {
      showNotice(error.response?.data?.detail || "Не удалось обновить прайс-лист");
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (source: Source) => {
    if (!confirm(`Удалить источник «${source.name}» вместе с позициями?`)) return;
    try {
      await api.delete(`/suppliers/sources/${source.id}`);
      await loadAll();
    } catch (error: any) {
      showNotice(error.response?.data?.detail || "Не удалось удалить источник");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <PackageSearch className="w-6 h-6 text-blue-500" />
            <span>Поставщики и прайс-листы</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Источники для AI-поиска поставщиков: открытые прайс-листы Excel/CSV или API
            B2B-агрегаторов. Категория по умолчанию — IT-оборудование.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddPresets}
            className="inline-flex items-center space-x-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Добавить B2B-пресеты</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить источник</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          {notice}
        </div>
      )}

      {/* Форма добавления */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Новый источник прайса</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Например: Прайс «Комус»"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название поставщика
              </label>
              <input
                type="text"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                placeholder="Как показывать в таблице сравнения"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип источника</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {categories.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL прайс-листа (Excel / CSV / JSON)
              </label>
              <input
                type="text"
                value={form.price_list_url}
                onChange={(e) => setForm({ ...form, price_list_url: e.target.value })}
                placeholder="https://example.com/price.xlsx"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL API (для типа «API агрегатора»)
              </label>
              <input
                type="text"
                value={form.api_url}
                onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                placeholder="https://api.supplier.ru/v1/products"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Срок доставки по умолчанию (дней)
              </label>
              <input
                type="number"
                min={0}
                value={form.default_delivery_days}
                onChange={(e) =>
                  setForm({ ...form, default_delivery_days: parseInt(e.target.value || "0", 10) })
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Добавление..." : "Добавить"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Открытые источники по категориям */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Открытые источники по категориям</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {category.is_default && <span className="mr-1">⭐</span>}
                  {category.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{category.description}</p>
              </div>
              <div className="text-right text-xs space-y-1 shrink-0">
                {category.price_source?.url && (
                  <a
                    href={category.price_source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-500 hover:text-blue-600"
                  >
                    прайс →
                  </a>
                )}
                {category.delivery_source?.url && (
                  <a
                    href={category.delivery_source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-500 hover:text-blue-600"
                  >
                    сроки доставки →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Источники */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
          <PackageSearch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Источники не подключены</p>
          <p className="text-sm text-gray-400 mt-1">
            Нажмите «Добавить B2B-пресеты», чтобы подключить прайсы дистрибьюторов
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Источник
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Тип
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Категория
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Позиций
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{source.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {source.price_list_url || source.api_url || "без URL"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {TYPE_LABELS[source.source_type] || source.source_type}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {source.category_label || "—"}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                      {source.offers_count}
                    </td>
                    <td className="px-4 py-4">
                      {source.last_error ? (
                        <span className="inline-flex items-center space-x-1 text-xs text-red-600">
                          <XCircle className="w-4 h-4" />
                          <span className="max-w-[220px] truncate" title={source.last_error}>
                            {source.last_error}
                          </span>
                        </span>
                      ) : source.last_sync_at ? (
                        <span className="inline-flex items-center space-x-1 text-xs text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {new Date(source.last_sync_at).toLocaleString("ru-RU")}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">не синхронизирован</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleSync(source)}
                          disabled={syncing === source.id}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          title="Обновить прайс-лист"
                        >
                          {syncing === source.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>Обновить</span>
                        </button>
                        <button
                          onClick={() => handleDelete(source)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
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

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
        <h3 className="font-semibold mb-2">Как это работает</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            Источник скачивает открытый прайс-лист (Excel/CSV/JSON) или отвечает API агрегатора и
            разбирает столбцы «Наименование», «Цена», «Артикул», «Срок поставки».
          </li>
          <li>
            Если прайс недоступен, источник не «падает»: подключается встроенный демо-каталог, а
            ошибка показывается в колонке «Статус».
          </li>
          <li>
            Дальше AI сверяет позиции с ТЗ тендера и возвращает match_percentage,
            matched_specs, mismatched_specs и warnings.
          </li>
          <li className="flex items-center space-x-1">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Обновляйте прайсы вручную или по расписанию парсера.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
