"use client";

import { useState } from "react";
import { LogOut, Home } from "lucide-react";

interface LogoutButtonProps {
  /** Тёмная тема — сайдбар админ-панели. */
  tone?: "light" | "dark";
  /** Текст кнопки. */
  label?: string;
  /** Куда попадает пользователь после выхода (окно авторизации). */
  loginHref?: string;
}

/**
 * Кнопка выхода внизу сайдбара личного кабинета и админ-панели.
 * По нажатию — модальное окно подтверждения:
 * «Вы действительно хотите выйти из личного кабинета?»
 * После «Да» — окно авторизации (кнопка «Войти» и ссылка на главную).
 */
export function LogoutButton({
  tone = "light",
  label = "Выйти",
  loginHref = "/auth/login?logout=1",
}: LogoutButtonProps) {
  const [open, setOpen] = useState(false);

  const isDark = tone === "dark";

  const handleConfirm = () => {
    try {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } catch {
      // localStorage может быть недоступен — выход всё равно выполняем
    }
    window.location.href = loginHref;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
          isDark
            ? "text-gray-400 hover:bg-gray-800 hover:text-white"
            : "text-gray-600 hover:bg-red-50 hover:text-red-600"
        }`}
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                isDark ? "bg-red-100 text-red-600" : "bg-red-100 text-red-600"
              }`}
            >
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Вы действительно хотите выйти из личного кабинета?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Несохранённые изменения будут потеряны. Для входа потребуется указать email и пароль.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 inline-flex items-center justify-center space-x-2 px-5 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                <span>Да, выйти</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-5 py-3 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              После выхода откроется окно авторизации — можно войти снова или перейти на главную
              страницу сайта.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Ссылка «Перейти на главную страницу сайта» — используется в окне авторизации. */
export function HomeLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      className={`inline-flex items-center justify-center space-x-2 text-sm font-medium text-gray-600 hover:text-blue-500 transition-colors ${className}`}
    >
      <Home className="w-4 h-4" />
      <span>Перейти на главную страницу сайта</span>
    </a>
  );
}
