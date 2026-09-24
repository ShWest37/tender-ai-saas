"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPost = async () => {
      try {
        const response = await api.get(`/blog/${slug}`);
        setPost(response.data);
      } catch (err) {
        console.error("Error loading post:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (slug) loadPost();
  }, [slug]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white pt-24 pb-16">
        <article className="container mx-auto px-4 max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center space-x-2 text-blue-500 hover:text-blue-600 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Все статьи</span>
          </Link>

          {loading ? (
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="aspect-video bg-gray-200 rounded-lg mb-8 mt-8" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ) : error || !post ? (
            <div className="text-center py-16">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Статья не найдена
              </h1>
              <p className="text-gray-500 mb-6">
                Возможно, она была удалена или перемещена
              </p>
              <Link
                href="/blog"
                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Вернуться к блогу
              </Link>
            </div>
          ) : (
            <>
              {/* Заголовок */}
              <header className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="text-xl text-gray-600 mb-4">{post.excerpt}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  {post.published_at && (
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(post.published_at).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                  )}
                </div>
              </header>

              {/* Обложка */}
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full aspect-video object-cover rounded-lg mb-8"
                />
              )}

              {/* Контент */}
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-3">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900">{children}</strong>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-blue-500 hover:text-blue-600 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4">
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* CTA */}
              <div className="mt-12 p-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl text-white text-center">
                <h2 className="text-2xl font-bold mb-3">
                  Готовы автоматизировать тендеры?
                </h2>
                <p className="mb-6 opacity-90">
                  Попробуйте Tender AI Director бесплатно — 3 дня полного доступа
                </p>
                <Link
                  href="/auth/register"
                  className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Начать бесплатно
                </Link>
              </div>
            </>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}