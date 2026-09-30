"use client";

import { useEffect, useState } from "react";
import { Save, Settings, Bell, Truck, Globe, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Category {
  id: string;
  label: string;
  description: string;
  is_default: boolean;
  price_source?: { name?: string; url?: string };
  delivery_source?: { name?: string; url?: string };
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "it_equipment",
    label: "IT-оборудование (компьютеры, серверы, периферия)",
    description: "Самый частый и структурированный тип закупок.",
    is_default: true,
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    site_name: "Tender AI Director",
    support_email: "support@bidflow.ru",
    admin_email: "admin@bidflow.ru",
    demo_days: 3,
    parsing_interval: 15,
    email_notifications: true,
    max_users: 1000,
    default_category: "it_equipment",
  });
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/settings");
      setSettings((current) => ({ ...current, ...response.data }));
      if (response.data.categories?.length) setCategories(response.data.categories);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await api.put("/admin/settings", settings);
      setSettings((current) => ({ ...current, ...response.data }));
      if (response.data.categories?.length) setCategories(response.data.categories);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error("Error saving settings:", err);
      setError(err.response?.data?.detail || "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки сайта</h1>
        <p className="text-sm text-gray-500 mt-1">
          Общие настройки и конфигурация
        </p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800">Настройки сохранены</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Выбор категории */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 mb-6">
          <Truck className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Выбор категории</h2>
            <p className="text-xs text-gray-500">
              Определяет, в каком рынке AI ищет поставщиков по ТЗ тендера
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((category, index) => (
            <label
              key={category.id}
              className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                settings.default_category === category.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="default_category"
                value={category.id}
                checked={settings.default_category === category.id}
                onChange={() => setSettings({ ...settings, default_category: category.id })}
                className="mt-1 w-4 h-4 text-blue-600"
              />
              <span className="flex-1">
                <span className="flex items-center flex-wrap gap-2">
                  <span className="font-medium text-gray-900">{category.label}</span>
                  {index === 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-full">
                      по умолчанию
                    </span>
                  )}
                  {category.id === settings.default_category && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[11px] font-semibold rounded-full">
                      выбрана
                    </span>
                  )}
                </span>
                {category.description && (
                  <span className="block text-sm text-gray-500 mt-1">{category.description}</span>
                )}
                {(category.price_source?.url || category.delivery_source?.url) && (
                  <span className="flex flex-wrap gap-3 text-xs mt-2">
                    {category.price_source?.url && (
                      <a
                        href={category.price_source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-500 hover:text-blue-600"
                      >
                        <Globe className="w-3 h-3" />
                        <span>открытый прайс</span>
                      </a>
                    )}
                    {category.delivery_source?.url && (
                      <a
                        href={category.delivery_source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-blue-500 hover:text-blue-600"
                      >
                        <Truck className="w-3 h-3" />
                        <span>источник сроков доставки</span>
                      </a>
                    )}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Основные настройки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 mb-6">
          <Settings className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Основные</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название сайта
            </label>
            <input
              type="text"
              value={settings.site_name}
              onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email поддержки
              </label>
              <input
                type="email"
                value={settings.support_email}
                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email администратора
              </label>
              <input
                type="email"
                value={settings.admin_email}
                onChange={(e) => setSettings({ ...settings, admin_email: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Демо-период (дней)
              </label>
              <input
                type="number"
                min={1}
                value={settings.demo_days}
                onChange={(e) => setSettings({ ...settings, demo_days: parseInt(e.target.value || "1", 10) })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Сколько дней полного доступа получает новый пользователь (по умолчанию 3)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Интервал парсинга (минут)
              </label>
              <input
                type="number"
                min={1}
                value={settings.parsing_interval}
                onChange={(e) =>
                  setSettings({ ...settings, parsing_interval: parseInt(e.target.value || "1", 10) })
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Уведомления */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 mb-6">
          <Bell className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">Уведомления</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Email уведомления</p>
              <p className="text-sm text-gray-500">Отправлять уведомления пользователям</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, email_notifications: !settings.email_notifications })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.email_notifications ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.email_notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Сохранение..." : "Сохранить настройки"}</span>
        </button>
      </div>
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
