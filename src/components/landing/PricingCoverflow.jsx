import React from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

function SlideCard({ tierId, tier, isActive, offset, onClick }) {
  const controls = useAnimationControls();

  React.useEffect(() => {
    controls.start({
      borderRadius: isActive ? '28px' : '18px',
      clipPath: isActive
        ? 'inset(0% round 28px)'
        : 'inset(1% 2% 1% 2% round 18px)',
      transition: { type: 'tween', duration: 0.35 }
    });
  }, [isActive]);

  const scale = isActive ? 1 : Math.max(0.82, 1 - Math.min(Math.abs(offset) * 0.12, 0.28));
  const rotateY = isActive ? 0 : Math.max(-18, Math.min(18, -offset * 12));
  const blur = isActive ? 0 : Math.min(3, Math.abs(offset) * 1.5);
  const opacity = isActive ? 1 : 0.9;
  const translateX = 0;

  return (
    <motion.div
      onClick={onClick}
      className="relative cursor-pointer select-none"
      style={{ perspective: 1000 }}
    >
      <motion.div
        animate={controls}
        className={`relative overflow-hidden border-2 ${
          tier.featured
            ? 'border-blue-900/70 bg-gradient-to-br from-blue-900/5 to-blue-900/10 shadow-xl'
            : 'border-slate-200 bg-white shadow-lg'
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: `translateX(${translateX}px) rotateY(${rotateY}deg) scale(${scale})`,
          filter: `blur(${blur}px)`,
          opacity,
        }}
      >
        {/* Sheen sweep on active */}
        {isActive && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ x: '-120%' }}
            animate={{ x: ['-120%', '120%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 65%)',
            }}
          />
        )}

        {/* Gradient sweep background */}
        <motion.div
          className="absolute inset-0 -z-10"
          animate={{
            backgroundPosition: isActive ? ['0% 50%', '100% 50%'] : '0% 50%',
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{
            backgroundImage:
              'radial-gradient(1200px 400px at 0% 50%, rgba(59,130,246,0.08), transparent), radial-gradient(1200px 400px at 100% 50%, rgba(147,51,234,0.08), transparent)',
            backgroundSize: '200% 100%',
          }}
        />

        <div className="p-7 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="text-5xl">{tier.icon}</div>
            {tier.featured && (
              <Badge className="bg-yellow-400 text-slate-900">Recommended</Badge>
            )}
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{tier.subtitle}</h3>
          <p className="text-sm text-slate-600 mt-1.5">{tier.description}</p>

          {/* Price */}
          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-slate-900">${tier.price}</span>
              <span className="text-slate-600">/year</span>
            </div>
          </div>

          {/* Features */}
          <div className={`mt-6 grid gap-2 ${isActive ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {(tier.features || []).slice(0, isActive ? 10 : 5).map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-900" /> Best for {tier.students} students
            </span>
            <Button variant="outline" size="sm" asChild>
              <a href="#addons">See add-ons</a>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Top ribbon for most popular */}
      {tier.featured && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-blue-900 text-white px-3 py-1 text-xs font-semibold">MOST POPULAR</Badge>
        </div>
      )}
    </motion.div>
  );
}

export default function PricingCoverflow({ tiers = {}, onSelect }) {
  const entries = React.useMemo(() => Object.entries(tiers), [tiers]);
  const initial = Math.min(1, Math.max(0, Math.floor(entries.length / 2)));
  const [selectedIndex, setSelectedIndex] = React.useState(initial);
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center', containScroll: 'trimSnaps', dragFree: false, loop: false });

  const onSelectEmbla = React.useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setSelectedIndex(idx);
    if (onSelect) {
      const [tierId] = entries[idx] || [];
      if (tierId) onSelect(tierId);
    }
  }, [emblaApi, entries, onSelect]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelectEmbla();
    emblaApi.on('select', onSelectEmbla);
    return () => {
      try { emblaApi.off('select', onSelectEmbla); } catch (_) {}
    };
  }, [emblaApi, onSelectEmbla]);

  const scrollTo = (i) => emblaApi && emblaApi.scrollTo(i);

  return (
    <div className="relative">
      {/* Desktop/Tablet coverflow */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6 items-stretch py-2">
          {entries.map(([tierId, tier], idx) => (
            <div
              key={tierId}
              className="min-w-[80%] sm:min-w-[60%] lg:min-w-[35%]"
            >
              <SlideCard
                tierId={tierId}
                tier={tier}
                isActive={idx === selectedIndex}
                offset={idx - selectedIndex}
                onClick={() => scrollTo(idx)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-2">
        {entries.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`h-2 rounded-full transition-all ${
              i === selectedIndex ? 'w-6 bg-slate-900' : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
            aria-label={`Go to tier ${i + 1}`}
          />)
        )}
      </div>
    </div>
  );
}