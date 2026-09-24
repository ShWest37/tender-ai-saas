"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
}

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
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Блог и <span className="gradient-text">статьи</span>
          </h2>
          <p className="text-gray-600">Полезные материалы о тендерах</p>
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
            <div key={i} className="card animate-pulse">
              <div className="aspect-video bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-500">Статьи пока не опубликованы</p>
          <p className="text-sm text-gray-400 mt-2">
            Следите за обновлениями — мы скоро добавим полезные материалы
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="card group cursor-pointer"
            >
              <Link href={`/blog/${post.slug}`}>
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="aspect-video object-cover rounded-lg mb-4 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg mb-4 group-hover:scale-105 transition-transform" />
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                  {post.published_at && (
                    <span>
                      {new Date(post.published_at).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-500 transition-colors">
                  {post.title}
                </h3>
                {post.excerpt && <p className="text-gray-600">{post.excerpt}</p>}
              </Link>
            </motion.article>
          ))}
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