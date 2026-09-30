"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FolderOpen,
  Search,
  Tag,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string | null;
}

interface Category {
  category: string;
  count: number;
}

const PAGE_SIZE = 9;

/** Примерное время чтения: 200 слов в минуту (по аннотации, если текста нет). */
function readingTime(post: BlogPost): number {
  const words = (post.excerpt || post.title || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 20) + 3);
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Поиск с дебаунсом: сбрасываем страницу и перезапрашиваем
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, activeCategory]);

  const loadCategories = async () => {
    try {
      const response = await api.get("/blog/categories");
      setCategories(response.data);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (query) params.query = query;
      if (activeCategory) params.category = activeCategory;

      const response = await api.get("/blog", { params });
      setPosts(response.data);
      const header = parseInt(response.headers["x-total-count"] || "", 10);
      setTotal(Number.isFinite(header) ? header : response.data.length);
    } catch (err) {
      console.error("Error loading blog:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setQuery("");
    setActiveCategory(null);
    setPage(1);
  };

  const hasFilters = Boolean(query || activeCategory);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const featured = !hasFilters && page === 1 && posts.length > 0 ? posts[0] : null;
  const rest = featured ? posts.slice(1) : posts;

  return (
    <>
      {/* Верхнее меню всегда отображается на странице блога */}
      <Header forceSolid />

      <main className="min-h-screen bg-gray-50 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Шапка */}
          <div className="mb-10">
            <Link
              href="/"
              className="inline-flex items-center space-x-2 text-blue-500 hover:text-blue-600 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>На главную</span>
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
            >
              Блог о <span className="gradient-text">тендерах и AI</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-gray-600 max-w-3xl"
            >
              Полезные статьи о применении искусственного интеллекта в тендерной работе,
              автоматизации закупок и повышении эффективности
            </motion.p>
          </div>

          {/* Панель: поиск + рубрики */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-8 sticky top-20 z-30">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по статьям: 44-ФЗ, AI, ошибка..."
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Очистить поиск"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !activeCategory
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Все рубрики
              </button>
              {categories.map((item) => (
                <button
                  key={item.category}
                  onClick={() => {
                    setActiveCategory(item.category === activeCategory ? null : item.category);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === item.category
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {item.category}
                  <span className="ml-1.5 text-xs opacity-70">{item.count}</span>
                </button>
              ))}
              {(hasFilters || page > 1) && (
                <button
                  onClick={resetFilters}
                  className="ml-auto inline-flex items-center space-x-1 text-sm text-gray-500 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                  <span>Сбросить</span>
                </button>
              )}
            </div>
          </div>

          {/* Результаты */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-200" />
                  <div className="p-6">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16 bg-white rounded-xl">
              <p className="text-gray-500 text-lg mb-4">Не удалось загрузить статьи</p>
              <button
                onClick={loadPosts}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Попробовать снова
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl">
              <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">
                {hasFilters ? "Ничего не найдено" : "Статьи пока не опубликованы"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {hasFilters
                  ? "Попробуйте изменить запрос или выбрать другую рубрику"
                  : "Следите за обновлениями — мы скоро добавим полезные материалы"}
              </p>
              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-6 px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Главная статья */}
              {featured && (
                <motion.article
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden mb-10 hover:shadow-lg transition-shadow group"
                >
                  <Link href={`/blog/${featured.slug}`} className="grid md:grid-cols-2">
                    <div className="relative overflow-hidden min-h-[220px]">
                      {featured.cover_image_url ? (
                        <img
                          src={featured.cover_image_url}
                          alt={featured.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Tag className="w-16 h-16 text-white/40" />
                        </div>
                      )}
                      <span className="absolute top-4 left-4 px-3 py-1 bg-white/95 text-blue-600 text-xs font-semibold rounded-full">
                        Главная статья
                      </span>
                    </div>
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
                        {featured.category && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                            <Tag className="w-3 h-3" />
                            <span>{featured.category}</span>
                          </span>
                        )}
                        {featured.published_at && (
                          <span className="inline-flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(featured.published_at)}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{readingTime(featured)} мин</span>
                        </span>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-500 transition-colors">
                        {featured.title}
                      </h2>
                      {featured.excerpt && (
                        <p className="text-gray-600 line-clamp-3">{featured.excerpt}</p>
                      )}
                      <span className="mt-4 text-blue-500 font-medium">Читать статью →</span>
                    </div>
                  </Link>
                </motion.article>
              )}

              {/* Сетка статей */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((post, index) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: Math.min(index, 5) * 0.05 }}
                    className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col"
                  >
                    <Link href={`/blog/${post.slug}`} className="flex flex-col h-full">
                      <div className="relative overflow-hidden">
                        {post.cover_image_url ? (
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            className="aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Tag className="w-12 h-12 text-white/50" />
                          </div>
                        )}
                        {post.category && (
                          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/95 text-blue-600 text-xs font-semibold rounded-full">
                            {post.category}
                          </span>
                        )}
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex items-center space-x-4 text-xs text-gray-400 mb-3">
                          {post.published_at && (
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(post.published_at)}</span>
                            </span>
                          )}
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{readingTime(post)} мин</span>
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-500 transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-gray-600 text-sm line-clamp-3">{post.excerpt}</p>
                        )}
                        <span className="mt-auto pt-4 text-sm text-blue-500 font-medium">
                          Читать →
                        </span>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </div>

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-4 mt-12">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-6 py-3 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 bg-white font-medium transition-colors"
                  >
                    ← Назад
                  </button>
                  <span className="text-sm text-gray-600 px-4">
                    Страница {page} из {totalPages} · статей: {total}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-6 py-3 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 bg-white font-medium transition-colors"
                  >
                    Вперёд →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
