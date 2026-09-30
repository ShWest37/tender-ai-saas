"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Search,
  Loader2,
  Newspaper,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category?: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

const emptyArticle = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  category: "",
  is_published: false,
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      // Загружаем все статьи (включая черновики) для админки
      const response = await api.get("/blog/all");
      setArticles(response.data);
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (isNew) {
        // Создание новой статьи
        await api.post("/blog", {
          title: editing.title,
          slug: editing.slug || (editing.title || "").toLowerCase().replace(/\s+/g, "-"),
          excerpt: editing.excerpt,
          content: editing.content,
          cover_image_url: editing.cover_image_url,
          category: editing.category || null,
          is_published: editing.is_published,
        });
      } else {
        // Обновление существующей статьи
        await api.put(`/blog/${editing.id}`, {
          title: editing.title,
          slug: editing.slug,
          excerpt: editing.excerpt,
          content: editing.content,
          cover_image_url: editing.cover_image_url,
          category: editing.category || null,
          is_published: editing.is_published,
        });
      }
      setEditing(null);
      setIsNew(false);
      loadArticles();
    } catch (error) {
      console.error("Error saving article:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить эту статью?")) return;
    setDeleting(id);
    try {
      await api.delete(`/blog/${id}`);
      loadArticles();
    } catch (error) {
      console.error("Error deleting article:", error);
    } finally {
      setDeleting(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEditing({ ...editing, cover_image_url: response.data.url });
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const filteredArticles = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Статьи блога</h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление статьями: создание, редактирование, публикация
          </p>
        </div>
        <button
          onClick={() => {
            setEditing({ ...emptyArticle });
            setIsNew(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Новая статья</span>
        </button>
      </div>

      {/* Поиск */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск статей..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Редактор */}
      {editing && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isNew ? "Новая статья" : "Редактирование статьи"}
            </h2>
            <button
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название статьи
              </label>
              <input
                type="text"
                value={editing.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Введите название статьи"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL (slug)
              </label>
              <input
                type="text"
                value={editing.slug || ""}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="article-url"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Рубрика */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Рубрика</label>
              <input
                type="text"
                value={editing.category || ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="Например: AI в тендерах, Право, Кейсы"
                list="dashboard-blog-categories"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="dashboard-blog-categories">
                {articles
                  .map((a) => a.category)
                  .filter((c, i, arr): c is string => Boolean(c) && arr.indexOf(c) === i)
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>

            {/* Краткое описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Краткое описание (для карточки в блоге)
              </label>
              <textarea
                value={editing.excerpt || ""}
                onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                placeholder="Краткое описание статьи для превью"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Изображение */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Обложка статьи
              </label>
              <div className="flex items-start space-x-4">
                {editing.cover_image_url ? (
                  <img
                    src={editing.cover_image_url}
                    alt="Обложка"
                    className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="text"
                    value={editing.cover_image_url || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, cover_image_url: e.target.value })
                    }
                    placeholder="URL изображения"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Загрузить файл
                    </button>
                    {editing.cover_image_url && (
                      <button
                        onClick={() =>
                          setEditing({ ...editing, cover_image_url: "" })
                        }
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Контент */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Содержание статьи (Markdown)
              </label>
              <textarea
                value={editing.content || ""}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                placeholder="Полный текст статьи в формате Markdown"
                rows={12}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />
            </div>

            {/* Публикация */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_published"
                checked={editing.is_published || false}
                onChange={(e) =>
                  setEditing({ ...editing, is_published: e.target.checked })
                }
                className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_published" className="text-sm font-medium text-gray-700">
                Опубликована
              </label>
            </div>

            {/* Кнопки */}
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={saving || !editing.title}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? "Сохранение..." : "Сохранить"}</span>
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setIsNew(false);
                }}
                className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Список статей */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Статьи не найдены</p>
          <p className="text-sm text-gray-400 mt-1">
            Создайте первую статью для блога
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row">
                {/* Изображение */}
                <div className="md:w-48 h-40 md:h-auto flex-shrink-0">
                  {article.cover_image_url ? (
                    <img
                      src={article.cover_image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <Newspaper className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Контент */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            article.is_published
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {article.is_published ? "Опубликована" : "Черновик"}
                        </span>
                        {article.published_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(article.published_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                    </div>

                    {/* Действия */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          setShowPreview(showPreview === article.id ? null : article.id)
                        }
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Предпросмотр"
                      >
                        {showPreview === article.id ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditing({ ...article });
                          setIsNew(false);
                        }}
                        className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(article.id)}
                        disabled={deleting === article.id}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Удалить"
                      >
                        {deleting === article.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Предпросмотр */}
                  {showPreview === article.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans">
                          {article.content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
