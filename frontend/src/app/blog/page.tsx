"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 9;

  useEffect(() => {
    loadPosts();
  }, [page]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/blog?page=${page}&page_size=${PAGE_SIZE}`);
      const data = response.data;
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setPosts(data);
    } catch (error) {
      console.error("Error loading blog:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center space-x-2 text-blue-500 hover:text-blue-600 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>На главную</span>
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Блог</h1>
            <p className="text-gray-600">Полезные статьи о тендерах и госзакупках</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="aspect-video bg-gray-200 rounded-lg mb-4" />
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg">
              <p className="text-gray-500">Статьи пока не опубликованы</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {posts.map((post, index) => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <Link href={`/blog/${post.slug}`}>
                      {post.cover_image_url ? (
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="aspect-video object-cover"
                        />
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100" />
                      )}
                      <div className="p-6">
                        {post.published_at && (
                          <p className="text-xs text-gray-400 mb-2">
                            {new Date(post.published_at).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        )}
                        <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-gray-600 text-sm line-clamp-3">
                            {post.excerpt}
                          </p>
                        )}
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </div>

              {/* Пагинация */}
              <div className="flex items-center justify-center space-x-2 mt-12">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 bg-white"
                >
                  ← Назад
                </button>
                <span className="text-sm text-gray-600 px-4">
                  Страница {page}
                </span>
                <button
                  onClick={() => hasMore && setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 bg-white"
                >
                  Вперёд →
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}