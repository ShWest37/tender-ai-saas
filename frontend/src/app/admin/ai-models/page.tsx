"use client";

import { useState, useEffect } from "react";
import { Bot, Plus, Edit2, Trash2, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface AIModel {
  id: number;
  name: string;
  provider: string;
  model_id: string;
  is_active: boolean;
  api_key: string;
}

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({ name: "", provider: "yandex_gpt", model_id: "", api_key: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await api.get("/ai/models");
      setModels(response.data);
    } catch (error) {
      console.error("Error loading models:", error);
      // Демо данные
      setModels([
        { id: 1, name: "Yandex GPT", provider: "yandex_gpt", model_id: "gpt-4o", is_active: true, api_key: "sk-***" },
        { id: 2, name: "GigaChat", provider: "gigachat", model_id: "gigachat-pro", is_active: true, api_key: "sk-***" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddModel = async () => {
    setAdding(true);
    try {
      await api.post("/ai/models", newModel);
      setShowAddForm(false);
      setNewModel({ name: "", provider: "yandex_gpt", model_id: "", api_key: "" });
      loadModels();
    } catch (error) {
      console.error("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm("Удалить эту модель?")) return;
    try {
      await api.delete(`/ai/models/${id}`);
      loadModels();
    } catch (error) {
      console.error("Error deleting model:", error);
    }
  };

  const toggleModelStatus = async (id: number, isActive: boolean) => {
    try {
      await api.put(`/ai/models/${id}`, { is_active: !isActive });
      loadModels();
    } catch (error) {
      console.error("Error updating model:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Модели</h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление AI моделями для генерации заявок
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить модель</span>
        </button>
      </div>

      {/* Форма добавления */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Новая AI модель</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={newModel.name}
                onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                placeholder="Название модели"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Провайдер</label>
              <select
                value={newModel.provider}
                onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="yandex_gpt">Yandex GPT</option>
                <option value="gigachat">GigaChat</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model ID</label>
              <input
                type="text"
                value={newModel.model_id}
                onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })}
                placeholder="gpt-4o"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API ключ</label>
              <input
                type="text"
                value={newModel.api_key}
                onChange={(e) => setNewModel({ ...newModel, api_key: e.target.value })}
                placeholder="API ключ"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={handleAddModel}
              disabled={adding || !newModel.name || !newModel.model_id}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {adding ? "Добавление..." : "Добавить"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список моделей */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => (
            <div key={model.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Bot className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    <p className="text-sm text-gray-500">{model.provider}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleModelStatus(model.id, model.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      model.is_active
                        ? "text-green-500 hover:bg-green-50"
                        : "text-gray-400 hover:bg-gray-50"
                    }`}
                    title={model.is_active ? "Деактивировать" : "Активировать"}
                  >
                    {model.is_active ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteModel(model.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Model ID:</span>
                  <span className="font-mono text-gray-900">{model.model_id}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Статус:</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      model.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {model.is_active ? "Активна" : "Неактивна"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
