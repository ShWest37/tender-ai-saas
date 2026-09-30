"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Play,
  Globe,
  Trash2,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Link2,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";

interface Platform {
  id: number;
  platform_name: string;
  name: string;
  url: string | null;
  api_url: string | null;
  is_active: boolean;
  status: "active" | "inactive" | "error" | "pending";
  last_run_at: string | null;
  last_error: string | null;
}

interface ParseResult {
  platform: string;
  platform_name: string;
  status: "success" | "error";
  tenders_found: number;
  created: number;
  message: string;
}

interface ToastState {
  type: "success" | "error" | "info";
  message: string;
}

const STATUS_META: Record<
  Platform["status"],
  { label: string; dot: string; text: string; Icon: typeof CheckCircle2 }
> = {
  active: { label: "Активна", dot: "bg-emerald-500", text: "text-emerald-600", Icon: CheckCircle2 },
  pending: { label: "Ожидает запуска", dot: "bg-amber-400", text: "text-amber-600", Icon: Clock },
  error: { label: "Ошибка", dot: "bg-red-500", text: "text-red-600", Icon: XCircle },
  inactive: { label: "Отключена", dot: "bg-gray-400", text: "text-gray-500", Icon: XCircle },
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsingPopular, setParsingPopular] = useState(false);
  const [parsingId, setParsingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [newPlatform, setNewPlatform] = useState({
    name: "",
    url: "",
    api_url: "",
    api_key: "",
  });

  const notify = (type: ToastState["type"], message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 6000);
  };

  const loadPlatforms = useCallback(async () => {
    try {
      const response = await api.get<Platform[]>("/admin/platforms");
      setPlatforms(response.data);
    } catch (error) {
      console.error("Error loading platforms:", error);
      notify("error", "Не удалось загрузить список площадок");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  /** Скрипт парсинга популярных тендерных площадок */
  const handleParsePopular = async () => {
    setParsingPopular(true);
    try {
      const response = await api.post<{
        results: ParseResult[];
        created: number;
        total: number;
        success: number;
      }>("/admin/platforms/parse-popular");
      const report = response.data;
      const failed = report.results.filter((r) => r.status === "error");
      if (failed.length === 0) {
        notify(
          "success",
          `Парсинг завершён: площадок ${report.total}, добавлено новых ${report.created}`,
        );
      } else {
        notify(
          "info",
          `Обработано ${report.total}, с ошибками ${failed.length}: ${failed
            .map((f) => f.platform)
            .join(", ")}`,
        );
      }
      await loadPlatforms();
    } catch (error) {
      console.error("Error parsing popular platforms:", error);
      notify("error", "Не удалось запустить парсинг популярных площадок");
    } finally {
      setParsingPopular(false);
    }
  };

  /** Парсинг одной площадки из таблицы */
  const handleParseOne = async (platform: Platform) => {
    setParsingId(platform.id);
    try {
      const response = await api.post<ParseResult>(
        `/admin/platforms/${platform.id}/parse`,
      );
      const result = response.data;
      if (result.status === "success") {
        notify("success", `${result.platform}: ${result.message}`);
      } else {
        notify("error", `${result.platform}: ${result.message}`);
      }
      await loadPlatforms();
    } catch (error) {
      console.error("Error parsing platform:", error);
      notify("error", `Не удалось запустить парсинг: ${platform.name}`);
    } finally {
      setParsingId(null);
    }
  };

  const handleAddPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatform.name.trim() || (!newPlatform.url.trim() && !newPlatform.api_url.trim())) {
      notify("error", "Укажите название и адрес сайта или API-адрес");
      return;
    }
    setAdding(true);
    try {
      const response = await api.post<{
        platform: Platform;
        probe: { ok: boolean; message: string } | null;
      }>("/admin/platforms", {
        name: newPlatform.name.trim(),
        url: newPlatform.url.trim() || null,
        api_url: newPlatform.api_url.trim() || null,
        api_key: newPlatform.api_key.trim() || null,
      });

      const { platform, probe } = response.data;
      if (probe) {
        if (probe.ok) {
          notify("success", `Площадка «${platform.name}» добавлена, API отвечает (${probe.message})`);
        } else {
          notify(
            "info",
            `Площадка «${platform.name}» добавлена, но API не отвечает: ${probe.message}`,
          );
        }
      } else {
        notify("success", `Площадка «${platform.name}» добавлена`);
      }

      setNewPlatform({ name: "", url: "", api_url: "", api_key: "" });
      setShowAddForm(false);
      await loadPlatforms();
    } catch (error) {
      console.error("Error adding platform:", error);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      notify(
        "error",
        typeof detail === "string" ? detail : "Не удалось добавить площадку",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (platform: Platform) => {
    try {
      await api.patch(`/admin/platforms/${platform.id}`, {
        is_active: !platform.is_active,
      });
      notify(
        "success",
        platform.is_active
          ? `Площадка «${platform.name}» отключена — скрыта из ЛК пользователей`
          : `Площадка «${platform.name}» включена — доступна пользователям`,
      );
      await loadPlatforms();
    } catch (error) {
      console.error("Error toggling platform:", error);
      notify("error", "Не удалось изменить статус площадки");
    }
  };

  const handleDelete = async (platform: Platform) => {
    if (!window.confirm(`Удалить площадку «${platform.name}» из каталога?`)) return;
    setDeletingId(platform.id);
    try {
      await api.delete(`/admin/platforms/${platform.id}`);
      notify("success", `Площадка «${platform.name}» удалена`);
      await loadPlatforms();
    } catch (error) {
      console.error("Error deleting platform:", error);
      notify("error", "Не удалось удалить площадку");
    } finally {
      setDeletingId(null);
    }
  };

  const total = platforms.length;
  const activeCount = platforms.filter((p) => p.status === "active").length;
  const errorCount = platforms.filter((p) => p.status === "error").length;
  const apiCount = platforms.filter((p) => p.api_url).length;

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString("ru-RU") : "Никогда";

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Тендерные площадки</h1>
          <p className="text-gray-500 mt-1">
            Каталог ЕТП: площадки, доступные пользователям для подачи заявок
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить площадку</span>
          </button>
          <button
            onClick={handleParsePopular}
            disabled={parsingPopular}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all disabled:opacity-60"
          >
            {parsingPopular ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {parsingPopular ? "Парсим площадки…" : "Запустить парсинг популярных"}
            </span>
          </button>
        </div>
      </div>

      {/* Сводка */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Всего площадок", value: total, Icon: Globe, color: "text-gray-900" },
            { label: "Активны", value: activeCount, Icon: CheckCircle2, color: "text-emerald-600" },
            { label: "С ошибкой", value: errorCount, Icon: AlertCircle, color: "text-red-600" },
            { label: "Подключён API", value: apiCount, Icon: Server, color: "text-blue-600" },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{card.label}</span>
                <card.Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && total === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Каталог площадок пуст</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Запустите скрипт парсинга популярных тендерных площадок — 8 крупных ЕТП
            появятся в таблице и станут доступны пользователям для подачи заявок.
          </p>
          <button
            onClick={handleParsePopular}
            disabled={parsingPopular}
            className="mt-6 inline-flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all disabled:opacity-60"
          >
            {parsingPopular ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{parsingPopular ? "Запускаем скрипт…" : "Запустить парсинг популярных"}</span>
          </button>
        </div>
      )}

      {/* Таблица */}
      {!loading && total > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">Наименование</th>
                  <th className="px-5 py-3 font-medium">Адрес сайта</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                  <th className="px-5 py-3 font-medium">API</th>
                  <th className="px-5 py-3 font-medium">Последний запуск</th>
                  <th className="px-5 py-3 font-medium text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {platforms.map((platform) => {
                  const meta = STATUS_META[platform.status] ?? STATUS_META.pending;
                  return (
                    <tr key={platform.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{platform.name}</div>
                            <div className="text-xs text-gray-400">{platform.platform_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {platform.url ? (
                          <a
                            href={platform.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:underline"
                          >
                            <span>{platform.url.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2" title={platform.last_error ?? meta.label}>
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot} ${
                              parsingId === platform.id ? "animate-pulse" : ""
                            }`}
                          />
                          <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
                        </div>
                        {platform.status === "error" && platform.last_error && (
                          <div className="text-xs text-red-500 mt-1 max-w-[260px] truncate" title={platform.last_error}>
                            {platform.last_error}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {platform.api_url ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                            <Link2 className="w-3 h-3" />
                            <span>API подключён</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">не подключён</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                        {formatDate(platform.last_run_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleParseOne(platform)}
                            disabled={parsingId === platform.id}
                            title="Запустить парсинг"
                            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {parsingId === platform.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleToggle(platform)}
                            title={platform.is_active ? "Отключить" : "Включить"}
                            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                              platform.is_active
                                ? "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            {platform.is_active ? "Включена" : "Отключена"}
                          </button>
                          <button
                            onClick={() => handleDelete(platform)}
                            disabled={deletingId === platform.id}
                            title="Удалить площадку"
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingId === platform.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="mt-3 text-sm">Загружаем каталог площадок…</span>
        </div>
      )}

      {/* Модалка добавления */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4"
          onClick={() => !adding && setShowAddForm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Добавление тендерной площадки"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Добавить тендерную площадку</h2>
              <button
                onClick={() => setShowAddForm(false)}
                disabled={adding}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Закрыть"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Площадка появится в каталоге и сразу станет доступна пользователям для
              подачи заявок. API-адрес нужен для загрузки тендеров.
            </p>

            <form onSubmit={handleAddPlatform} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Наименование площадки *
                </label>
                <input
                  type="text"
                  required
                  value={newPlatform.name}
                  onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
                  placeholder="Например: РТС-тендер"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Адрес сайта *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    required
                    value={newPlatform.url}
                    onChange={(e) => setNewPlatform({ ...newPlatform, url: e.target.value })}
                    placeholder="https://example.ru"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  API-адрес площадки
                </label>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={newPlatform.api_url}
                    onChange={(e) => setNewPlatform({ ...newPlatform, api_url: e.target.value })}
                    placeholder="https://api.example.ru/v1/tenders"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  При добавлении проверим, что API отвечает. Без него площадку можно
                  подключить позже.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  API-ключ (если требуется)
                </label>
                <input
                  type="text"
                  value={newPlatform.api_key}
                  onChange={(e) => setNewPlatform({ ...newPlatform, api_key: e.target.value })}
                  placeholder="Bearer-токен или ключ доступа"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  disabled={adding}
                  className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all disabled:opacity-60"
                >
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{adding ? "Добавляем…" : "Добавить площадку"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Тост */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[95] max-w-md flex items-start space-x-2 px-4 py-3 rounded-xl shadow-lg border bg-white ${
            toast.type === "success"
              ? "border-emerald-200 text-emerald-700"
              : toast.type === "error"
                ? "border-red-200 text-red-700"
                : "border-amber-200 text-amber-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : toast.type === "error" ? (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
