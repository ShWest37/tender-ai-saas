import { Header } from '@/components/layout/Header'
import { HeroSlider } from '@/components/home/HeroSlider'
import { Features } from '@/components/home/Features'
import { Comparison } from '@/components/home/Comparison'
import { Benefits } from '@/components/home/Benefits'
import { UIPTypes } from '@/components/home/UIPTypes'
import { PricingCards } from '@/components/home/PricingCards'
import { PlatformSlider } from '@/components/home/PlatformSlider'
import { CTASection } from '@/components/home/CTASection'
import { BlogPreview } from '@/components/home/BlogPreview'
import { Footer } from '@/components/layout/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {/* Раздел 1: Hero Slider (5 слайдов) */}
        <HeroSlider />
        
        {/* Раздел 2: О сервисе */}
        <section id="about" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <Features />
          </div>
        </section>
        
        {/* Раздел 3: Преимущества */}
        <section id="benefits" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <Benefits />
          </div>
        </section>
        
        {/* Раздел 4: Сравнение (с сервисом и без) */}
        <section id="comparison" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <Comparison />
          </div>
        </section>
        
        {/* Раздел 5: Выгоды (ROI) */}
        <section id="roi" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <UIPTypes />
          </div>
        </section>
        
        {/* Раздел 6: Тарифы */}
        <section id="pricing" className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <PricingCards />
          </div>
        </section>
        
        {/* Раздел 7: Площадки (слайдер) */}
        <section id="platforms" className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <PlatformSlider />
          </div>
        </section>
        
        {/* Раздел 8: Призыв к действию */}
        <section id="cta" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="container mx-auto px-4">
            <CTASection />
          </div>
        </section>
        
        {/* Раздел 9: Блог (превью) */}
        <section id="blog" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <BlogPreview />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}