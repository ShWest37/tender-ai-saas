"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Award,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Подсказки из query: выход завершён / недостаточно прав
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout") === "1") setNotice("Вы вышли из админ-панели");
    if (params.get("error") === "forbidden")
      setError("Для входа нужна учётная запись администратора");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await api.post("/auth/login", formData);
      localStorage.setItem("access_token", response.data.access_token);
      localStorage.setItem("refresh_token", response.data.refresh_token);

      // Проверяем, что это именно администратор
      const { data } = await api.get("/auth/me");
      if (data?.role !== "ADMIN") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setError("Эта учётная запись не имеет прав администратора");
        setLoading(false);
        return;
      }
      router.push("/admin");
    } catch (err: unknown) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 400) {
        setError("Неверный логин или пароль");
      } else {
        setError("Не удалось войти. Повторите попытку позже");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Декоративные градиентные пятна фирменных цветов */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] bg-orange-600/20 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Логотип */}
        <Link href="/" className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30">
            <Award className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <span className="block font-bold text-white text-lg leading-tight">Tender AI</span>
            <span className="block text-xs text-gray-400">Админ-панель</span>
          </div>
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-white">Вход для администратора</h1>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            Раздел доступен только сотрудникам с правами администратора
          </p>

          {notice && (
            <div className="mb-4 flex items-start space-x-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start space-x-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Логин
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@bidflow.ru"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-11 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Входим…</span>
                </>
              ) : (
                <>
                  <span>Войти в админ-панель</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            ← На главную
          </Link>
          <span className="text-gray-700">·</span>
          <Link href="/auth/login" className="hover:text-gray-300 transition-colors">
            Вход для пользователей
          </Link>
        </div>
      </div>
    </div>
  );
}
