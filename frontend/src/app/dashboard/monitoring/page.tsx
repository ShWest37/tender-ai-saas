"use client";

import { useState } from "react";
import { Bell, Mail, Clock, CheckCircle, Settings } from "lucide-react";
import { api } from "@/lib/api";

export default function MonitoringPage() {
  const [settings, setSettings] = useState({
    email_notifications: true,
    notification_email: "user@example.com",
    notify_new_tenders: true,
    notify_application_status: true,
    notify_demo_expiring: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/notifications/preferences", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Автоматический мониторинг</h1>
        <p className="text-sm text-gray-500 mt-1">
          Автоматический сбор тендеров и уведомления о новых закупках каждые 15 минут
        </p>
      </div>

      {/* Статус */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Мониторинг активен</h3>
            <p className="text-sm text-green-800">
              Тендеры собираются каждые 15 минут с подключённых площадок
            </p>
          </div>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800">Настройки сохранены</p>
        </div>
      )}

      {/* Настройки уведомлений */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200 mb-6">
          <Settings className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Настройки уведомлений</h2>
        </div>

        <div className="space-y-6">
          {/* Email для уведомлений */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email для уведомлений
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={settings.notification_email}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Уведомления будут приходить на этот email
            </p>
          </div>

          {/* Переключатели */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email уведомления</p>
                <p className="text-sm text-gray-500">Получать уведомления на email</p>
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

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Новые тендеры</p>
                <p className="text-sm text-gray-500">Уведомлять о новых закупках</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, notify_new_tenders: !settings.notify_new_tenders })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notify_new_tenders ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notify_new_tenders ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Статус заявок</p>
                <p className="text-sm text-gray-500">Уведомлять об изменении статуса заявок</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, notify_application_status: !settings.notify_application_status })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notify_application_status ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notify_application_status ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Демо-период</p>
                <p className="text-sm text-gray-500">Уведомлять об истечении демо-периода</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, notify_demo_expiring: !settings.notify_demo_expiring })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notify_demo_expiring ? "bg-blue-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.notify_demo_expiring ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
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
          <CheckCircle className="w-4 h-4" />
          <span>{saving ? "Сохранение..." : "Сохранить настройки"}</span>
        </button>
      </div>
    </div>
  );
}
