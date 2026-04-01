import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const getYoutubeEmbedUrl = (url) => {
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) return url;

  if (url.includes('embed/')) {
    return `${url}${url.includes('?') ? '&' : '?'}autoplay=1&mute=1&loop=1&controls=0&rel=0&modestbranding=1`;
  }

  const shortId = url.includes('youtu.be/') ? url.split('youtu.be/')[1]?.split('?')[0] : null;
  const watchId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : null;
  const videoId = shortId || watchId;

  if (!videoId) return url;

  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&rel=0&modestbranding=1&playlist=${videoId}`;
};

export default function ScrollExpansionHero({
  mediaType = 'image',
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand,
  textBlend,
  children,
}) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobileState, setIsMobileState] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const resetSection = () => {
      setScrollProgress(0);
      setShowContent(false);
      setMediaFullyExpanded(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    resetSection();
    window.addEventListener('resetSection', resetSection);

    return () => window.removeEventListener('resetSection', resetSection);
  }, [mediaType]);

  useEffect(() => {
    const handleWheel = (e) => {
      const insideSection = sectionRef.current?.getBoundingClientRect().top ?? 0;
      if (insideSection > window.innerHeight * 0.25) return;

      if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        e.preventDefault();
        return;
      }

      if (!mediaFullyExpanded) {
        e.preventDefault();
        const scrollDelta = e.deltaY * 0.0009;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (newProgress < 0.75) {
          setShowContent(false);
        }
      }
    };

    const handleTouchStart = (e) => {
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
      if (!touchStartY) return;

      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        e.preventDefault();
      } else if (!mediaFullyExpanded) {
        e.preventDefault();
        const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
        const scrollDelta = deltaY * scrollFactor;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (newProgress < 0.75) {
          setShowContent(false);
        }

        setTouchStartY(touchY);
      }
    };

    const handleTouchEnd = () => setTouchStartY(0);
    const handleScroll = () => {
      if (!mediaFullyExpanded && window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollProgress, mediaFullyExpanded, touchStartY]);

  useEffect(() => {
    const checkIfMobile = () => setIsMobileState(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const mediaWidth = 320 + scrollProgress * (isMobileState ? 620 : 1050);
  const mediaHeight = 420 + scrollProgress * (isMobileState ? 200 : 320);
  const textTranslateX = scrollProgress * (isMobileState ? 24 : 18);
  const firstWord = title ? title.split(' ')[0] : '';
  const restOfTitle = title ? title.split(' ').slice(1).join(' ') : '';

  return (
    <div ref={sectionRef} className="overflow-x-hidden bg-slate-950 text-white transition-colors duration-700 ease-in-out">
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-start">
        <div className="relative flex min-h-[100dvh] w-full flex-col items-center">
          <motion.div
            className="absolute inset-0 z-0 h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - scrollProgress * 0.85 }}
            transition={{ duration: 0.1 }}
          >
            <img
              src={bgImageSrc}
              alt="Background"
              className="h-screen w-screen object-cover object-center"
            />
            <div className="absolute inset-0 bg-slate-950/55" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.35),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.25),transparent_35%)]" />
          </motion.div>

          <div className="container relative z-10 mx-auto flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8">
            <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center">
              <div
                className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/10 bg-slate-900/70 p-2 shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-none"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: '96vw',
                  maxHeight: '86vh',
                }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950">
                  {mediaType === 'video' ? (
                    mediaSrc.includes('youtube.com') || mediaSrc.includes('youtu.be') ? (
                      <div className="relative h-full w-full pointer-events-none">
                        <iframe
                          title={title || 'Showcase video'}
                          width="100%"
                          height="100%"
                          src={getYoutubeEmbedUrl(mediaSrc)}
                          className="h-full w-full rounded-[1.2rem]"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        <motion.div
                          className="absolute inset-0 rounded-[1.2rem] bg-slate-950/30"
                          initial={{ opacity: 0.7 }}
                          animate={{ opacity: 0.45 - scrollProgress * 0.25 }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    ) : (
                      <div className="relative h-full w-full pointer-events-none">
                        <video
                          src={mediaSrc}
                          poster={posterSrc}
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          className="h-full w-full rounded-[1.2rem] object-cover"
                        />
                        <motion.div
                          className="absolute inset-0 rounded-[1.2rem] bg-slate-950/30"
                          initial={{ opacity: 0.7 }}
                          animate={{ opacity: 0.45 - scrollProgress * 0.25 }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    )
                  ) : (
                    <div className="relative h-full w-full">
                      <img
                        src={mediaSrc}
                        alt={title || 'Media content'}
                        className="h-full w-full rounded-[1.2rem] object-cover"
                      />
                      <motion.div
                        className="absolute inset-0 rounded-[1.2rem] bg-slate-950/35"
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 0.5 - scrollProgress * 0.2 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-4 flex flex-col items-center text-center transition-none">
                  {date ? (
                    <p
                      className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-200 md:text-base"
                      style={{ transform: `translateX(-${textTranslateX}vw)` }}
                    >
                      {date}
                    </p>
                  ) : null}
                  {scrollToExpand ? (
                    <p
                      className="mt-2 text-sm font-medium text-blue-100/85 md:text-base"
                      style={{ transform: `translateX(${textTranslateX}vw)` }}
                    >
                      {scrollToExpand}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={`relative z-10 flex w-full flex-col items-center justify-center gap-3 pt-[72vh] text-center transition-none ${
                  textBlend ? 'mix-blend-screen' : 'mix-blend-normal'
                }`}
              >
                <motion.h2
                  className="text-4xl font-semibold tracking-tight text-white md:text-6xl lg:text-7xl"
                  style={{ transform: `translateX(-${textTranslateX}vw)` }}
                >
                  {firstWord}
                </motion.h2>
                <motion.h2
                  className="text-4xl font-semibold tracking-tight text-cyan-100 md:text-6xl lg:text-7xl"
                  style={{ transform: `translateX(${textTranslateX}vw)` }}
                >
                  {restOfTitle}
                </motion.h2>
              </div>
            </div>

            <motion.section
              className="flex w-full flex-col px-0 py-10 md:px-4 lg:py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.7 }}
            >
              {children}
            </motion.section>
          </div>
        </div>
      </section>
    </div>
  );
}