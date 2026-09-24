"use client";

import { useState, useEffect } from "react";
import { User, Building, Save, Loader2, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    inn: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        company_name: user.company_name || "",
        inn: "",
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/auth/profile", formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-500 mt-1">
          Управление профилем и компанией
        </p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800">Настройки сохранены</p>
        </div>
      )}

      {/* Профиль */}
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
          <User className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Личные данные</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={user?.email || ""}
            disabled
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">Email нельзя изменить</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ФИО
          </label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
          <Building className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">Компания</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название компании
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ИНН
          </label>
          <input
            type="text"
            value={formData.inn}
            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
            maxLength={12}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Сохранение...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Сохранить изменения</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}