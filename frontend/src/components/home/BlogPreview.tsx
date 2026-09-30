"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Tag } from "lucide-react";
import { api } from "@/lib/api";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

// Градиентные фоны для статей (если нет изображения)
const gradients = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-purple-500",
  "from-teal-500 to-cyan-500",
];

const itemVariantsLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const itemVariantsRight = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const itemVariantsCenter = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export function BlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await api.get("/blog?page_size=3");
        setPosts(response.data);
      } catch (error) {
        console.error("Error loading blog posts:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-12">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-2"
          >
            Блог и <span className="gradient-text">статьи</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-600"
          >
            Полезные материалы о тендерах и AI
          </motion.p>
        </div>
        <Link
          href="/blog"
          className="hidden md:flex items-center space-x-2 text-blue-500 hover:text-blue-600 font-medium"
        >
          <span>Все статьи</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <div className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">Статьи пока не опубликованы</p>
          <p className="text-sm text-gray-400 mt-2">
            Следите за обновлениями — мы скоро добавим полезные материалы
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post, index) => {
            const variants =
              index % 3 === 0
                ? itemVariantsLeft
                : index % 3 === 2
                ? itemVariantsRight
                : itemVariantsCenter;

            const gradient = gradients[index % gradients.length];

            return (
              <motion.article
                key={post.id}
                variants={variants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 group"
              >
                <Link href={`/blog/${post.slug}`}>
                  <div className="flex flex-col h-full">
                    {/* Изображение/градиент — только визуал, без текста */}
                    <div className="relative overflow-hidden">
                      {post.cover_image_url ? (
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div
                          className={`aspect-video bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:32px_32px]" />
                          <Tag className="w-16 h-16 text-white/50" />
                        </div>
                      )}
                    </div>

                    {/* Текст отдельно от изображения */}
                    <div className="p-6 flex-1">
                      {post.published_at && (
                        <div className="flex items-center space-x-2 text-xs text-gray-400 mb-3">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(post.published_at).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-500 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-gray-600 text-sm line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center md:hidden">
        <Link
          href="/blog"
          className="inline-flex items-center space-x-2 text-blue-500 hover:text-blue-600 font-medium"
        >
          <span>Все статьи</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
