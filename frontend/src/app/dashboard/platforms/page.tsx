"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Wrench,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";

interface UserPlatform {
  id: number;
  name: string;
  url: string | null;
  status: "active" | "inactive" | "error" | "pending";
}

const STATUS_META: Record<
  UserPlatform["status"],
  { label: string; dot: string; text: string; Icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Доступна для подачи заявок",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Площадка подключается",
    dot: "bg-amber-400",
    text: "text-amber-600",
    Icon: Clock,
  },
  error: {
    label: "Технические работы",
    dot: "bg-red-500",
    text: "text-red-600",
    Icon: Wrench,
  },
  inactive: {
    label: "Временно недоступна",
    dot: "bg-gray-400",
    text: "text-gray-500",
    Icon: Clock,
  },
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<UserPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.get<UserPlatform[]>("/platforms");
        if (!cancelled) setPlatforms(response.data);
      } catch (err) {
        console.error("Error loading platforms:", err);
        if (!cancelled) setError("Не удалось загрузить список площадок");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const available = platforms.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Тендерные площадки</h1>
        <p className="text-gray-500 mt-1">
          Электронные торговые площадки, подключённые к системе
        </p>
      </div>

      {/* Банер о доступности */}
      {!loading && platforms.length > 0 && (
        <div className="flex items-start space-x-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">
              {available} из {platforms.length} площадок доступны для подачи заявок.
            </span>{" "}
            Выберите площадку, изучите требования и подайте заявку на участие в
            закупке.
          </p>
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="mt-3 text-sm">Загружаем площадки…</span>
        </div>
      )}

      {/* Ошибка */}
      {!loading && error && (
        <div className="bg-white border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && !error && platforms.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
            <Globe className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Площадки ещё не добавлены
          </h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Администратор подключает тендерные площадки в админ-панели — после этого
            они появятся здесь и станут доступны для подачи заявок.
          </p>
        </div>
      )}

      {/* Карточки площадок */}
      {!loading && !error && platforms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {platforms.map((platform) => {
            const meta = STATUS_META[platform.status] ?? STATUS_META.pending;
            return (
              <div
                key={platform.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-orange-200 transition-all flex flex-col"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{platform.name}</h3>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                      <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                    </div>
                  </div>
                </div>

                {platform.url && (
                  <a
                    href={platform.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:underline mt-4 truncate"
                  >
                    <span className="truncate">{platform.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                )}

                <div className="mt-auto pt-4">
                  <a
                    href={platform.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      platform.status === "active"
                        ? "bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    aria-disabled={platform.status !== "active"}
                    onClick={(e) => {
                      if (platform.status !== "active" || !platform.url) e.preventDefault();
                    }}
                  >
                    <span>Перейти на площадку</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Подсказка */}
      {!loading && platforms.length > 0 && (
        <div className="flex items-start space-x-2 text-sm text-gray-500">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Список формируется администратором. Если нужной площадки нет — напишите
            в поддержку, мы подключим её.
          </p>
        </div>
      )}
    </div>
  );
}
