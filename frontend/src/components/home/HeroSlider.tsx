"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, TrendingUp, Shield, Zap, Award } from "lucide-react";
import { RegisterModal } from "@/components/modals/RegisterModal";

const slides = [
  {
    icon: Bot,
    title: "AI-Директор по тендерам",
    subtitle: "Выигрывайте закупки, пока конкуренты читают документацию",
    description: "Искусственный интеллект анализирует тысячи тендеров и готовит заявки за минуты",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Zap,
    title: "Автогенерация Формы 2",
    subtitle: "За 3 минуты вместо 3 часов",
    description: "AI заполняет все поля заявки, проверяет на ошибки и готовит к подаче",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Shield,
    title: "0 ошибок модераторов",
    subtitle: "Точность до 99.9%",
    description: "Двухступенчатая проверка AI-критиком исключает отклонение заявок",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: TrendingUp,
    title: "Единое окно для 8 ЕТП",
    subtitle: "Все площадки в одном интерфейсе",
    description: "Подача заявок через ЭЦП без регистрации на каждой площадке отдельно",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Award,
    title: "Предиктивная аналитика",
    subtitle: "Знайте результат до подачи",
    description: "AI предсказывает шансы на победу и рекомендует оптимальную цену",
    color: "from-red-500 to-rose-500",
  },
];

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  const scrollToDemo = () => {
    const el = document.getElementById("comparison");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 overflow-hidden pt-20">
        {/* Фоновые элементы */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: "4s" }} />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {/* Иконка */}
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${slides[currentSlide].color} mb-8 shadow-2xl`}>
                  {slides[currentSlide].icon && (
                    <slides.currentSlide.icon className="w-10 h-10 text-white" />
                  )}
                </div>

                {/* Заголовок */}
                <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  {slides[currentSlide].title}
                </h1>

                {/* Подзаголовок */}
                <p className="text-xl md:text-2xl text-gray-600 mb-4 font-medium">
                  {slides[currentSlide].subtitle}
                </p>

                {/* Описание */}
                <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
                  {slides[currentSlide].description}
                </p>

                {/* Кнопки — ИСПРАВЛЕНО: добавлены onClick */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="btn-primary w-full sm:w-auto px-8 py-4 text-lg"
                  >
                    Начать бесплатно — 3 дня
                  </button>
                  <button
                    onClick={scrollToDemo}
                    className="btn-secondary w-full sm:w-auto px-8 py-4 text-lg"
                  >
                    Смотреть демо
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Индикаторы слайдов */}
            <div className="flex justify-center mt-12 space-x-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-3 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "bg-blue-500 w-8"
                      : "bg-gray-300 hover:bg-gray-400 w-3"
                  }`}
                  aria-label={`Слайд ${index + 1}`}
                />
              ))}
            </div>

            {/* Прогресс-бар */}
            <div className="max-w-md mx-auto mt-6 h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 7, ease: "linear", repeat: Infinity }}
                key={currentSlide}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ✅ ИСПРАВЛЕНО: модалка регистрации */}
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onOpenLogin={() => {
          setShowRegisterModal(false);
          window.location.href = "/auth/login";
        }}
      />
    </>
  );
}