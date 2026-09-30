"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, TrendingUp, Shield, Zap, Award } from "lucide-react";
import { RegisterModal } from "@/components/modals/RegisterModal";

/**
 * Слайды главной (УТП). Каждый слайд поддержан картинкой по смыслу —
 * локальные копии фотографий Unsplash (та же схема, что в блоге):
 *   /images/hero/*.jpg — исходники: images.unsplash.com/photo-<id>
 * Если картинка не загрузится, под ней остаётся цветной градиент слайда.
 */
const slides = [
  {
    icon: Bot,
    title: "AI-Директор по тендерам",
    subtitle: "Выигрывайте закупки, пока конкуренты читают документацию",
    description: "Искусственный интеллект анализирует тысячи тендеров и готовит заявки за минуты",
    color: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-950 via-blue-900 to-cyan-950",
    pattern: "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 40%)",
    image: "/images/hero/ai-director.jpg",
    scrim: 0.55,
  },
  {
    icon: Zap,
    title: "Автогенерация Формы 2",
    subtitle: "За 3 минуты вместо 3 часов",
    description: "AI заполняет все поля заявки, проверяет на ошибки и готовит к подаче",
    color: "from-yellow-500 to-orange-500",
    bgGradient: "from-amber-950 via-orange-950 to-red-950",
    pattern: "radial-gradient(circle at 30% 70%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(239, 68, 68, 0.1) 0%, transparent 40%)",
    image: "/images/hero/auto-generation.jpg",
    scrim: 0.75,
  },
  {
    icon: Shield,
    title: "0 ошибок модераторов",
    subtitle: "Точность до 99.9%",
    description: "Двухступенчатая проверка AI-критиком исключает отклонение заявок",
    color: "from-green-500 to-emerald-500",
    bgGradient: "from-emerald-950 via-green-950 to-teal-950",
    pattern: "radial-gradient(circle at 25% 60%, rgba(16, 185, 129, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(20, 184, 166, 0.1) 0%, transparent 40%)",
    image: "/images/hero/zero-errors.jpg",
    scrim: 0.72,
  },
  {
    icon: TrendingUp,
    title: "Предиктивная аналитика",
    subtitle: "Знайте результат до подачи",
    description: "AI предсказывает шансы на победу и рекомендует оптимальную цену",
    color: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-950 via-violet-950 to-fuchsia-950",
    pattern: "radial-gradient(circle at 20% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 60%, rgba(217, 70, 239, 0.1) 0%, transparent 40%)",
    image: "/images/hero/predictive-analytics.jpg",
    scrim: 0.55,
  },
  {
    icon: Award,
    title: "Единое окно для работы",
    subtitle: "Все процессы в одном интерфейсе",
    description: "Подача заявок через ЭЦП без регистрации на каждой площадке отдельно",
    color: "from-red-500 to-rose-500",
    bgGradient: "from-rose-950 via-red-950 to-pink-950",
    pattern: "radial-gradient(circle at 30% 50%, rgba(244, 63, 94, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 40%)",
    image: "/images/hero/single-window.jpg",
    scrim: 0.68,
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
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Статичный тёмный фон */}
        <div className="absolute inset-0 bg-gray-950" />

        {/* Фоновые слои: картинка по смыслу слайда поверх цветного градиента */}
        <AnimatePresence mode="sync">
          {slides.map((slide, index) => (
            <motion.div
              key={index}
              initial={false}
              animate={{
                opacity: currentSlide === index ? 1 : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0"
              style={{ zIndex: currentSlide === index ? 1 : 0 }}
            >
              {/* Градиент — база и фолбэк, если картинка не загрузилась */}
              <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`} />

              {/* Картинка по смыслу УТП (локальная копия Unsplash, как в блоге) */}
              <img
                src={slide.image}
                alt=""
                aria-hidden="true"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(event) => {
                  // нет картинки — остаёмся на градиенте
                  event.currentTarget.style.display = "none";
                }}
              />

              {/* Цветовой оттенок слайда поверх фотографии */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient} opacity-40 mix-blend-color`}
              />

              {/* Затемнение под читаемость белого текста */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(2, 6, 23, ${slide.scrim})` }}
              />

              {/* Паттерн */}
              <div className="absolute inset-0" style={{ background: slide.pattern }} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Анимированные фоновые элементы */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float" style={{ animationDelay: "4s" }} />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float" style={{ animationDelay: "3s" }} />
        </div>

        {/* Сетка на фоне */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {/* Иконка */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${slides[currentSlide].color} mb-8 shadow-2xl`}
                >
                  {(() => {
                    const Icon = slides[currentSlide].icon;
                    return <Icon className="w-10 h-10 text-white" />;
                  })()}
                </motion.div>

                {/* Заголовок */}
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                  {slides[currentSlide].title}
                </h1>

                {/* Подзаголовок */}
                <p className="text-xl md:text-2xl text-blue-200 mb-4 font-medium">
                  {slides[currentSlide].subtitle}
                </p>

                {/* Описание */}
                <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
                  {slides[currentSlide].description}
                </p>

                {/* Кнопки */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="w-full sm:w-auto px-8 py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    Начать бесплатно — 3 дня
                  </button>
                  <button
                    onClick={scrollToDemo}
                    className="w-full sm:w-auto px-8 py-4 text-lg bg-white/10 backdrop-blur-md text-white font-medium rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-300"
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
                  className={`h-2 rounded-full transition-all duration-500 ${
                    index === currentSlide
                      ? "bg-white w-8"
                      : "bg-white/30 hover:bg-white/50 w-2"
                  }`}
                  aria-label={`Слайд ${index + 1}`}
                />
              ))}
            </div>

            {/* Прогресс-бар */}
            <div className="max-w-md mx-auto mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 7, ease: "linear", repeat: Infinity }}
                key={currentSlide}
              />
            </div>
          </div>
        </div>

        {/* Стрелка вниз */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
          >
            <div className="w-1.5 h-3 bg-white/50 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

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
