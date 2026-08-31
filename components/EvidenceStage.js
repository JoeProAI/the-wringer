"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export const GAMMA_SLIDES = [
  { src: "/examples/gamma-example-cover.png", alt: "GAMMA cover: Exit SUCCESS, reviewer confidence 0.9, winner Claude" },
  { src: "/examples/gamma-example-verdict.png", alt: "Verdict at a glance: mission, outcome, acceptance criteria status" },
  { src: "/examples/gamma-example-content.png", alt: "Rayleigh scattering explanation with scientific citations" },
  { src: "/examples/gamma-example-scatter.png", alt: "Why shorter wavelengths scatter more: inverse fourth power law" },
  { src: "/examples/gamma-example-candidates.png", alt: "Worker candidates: Claude, Codex, Grok evidence chain" },
  { src: "/examples/gamma-example-evidence.png", alt: "Evidence chain: citations and source verification" },
  { src: "/examples/gamma-example-verification.png", alt: "Verification and risks: what was verified and recommendations" },
  { src: "/examples/gamma-example-refs.png", alt: "References and conclusion" },
];

export const GAMMA_DECK_URL = "https://gamma.app/docs/587k5a9m9kd8kt5";
export const GAMMA_PDF_URL = "https://assets.api.gamma.app/export/pdf/587k5a9m9kd8kt5/f1ecf4b45609e28c9b794b26153b6e99/MECHA-Run-Report-mecha-1788103355-4bd3f4.pdf";

export default function EvidenceStage({ slides = GAMMA_SLIDES, deckUrl = GAMMA_DECK_URL, pdfUrl = GAMMA_PDF_URL, compact = false }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgError, setImgError] = useState({});
  const filmstripRef = useRef(null);
  const thumbRefs = useRef([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPrefersReducedMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false);
    }
  }, []);

  const selectSlide = useCallback((index) => {
    if (index >= 0 && index < slides.length) {
      setActiveIndex(index);
      thumbRefs.current[index]?.focus();
    }
  }, [slides.length]);

  const handleKeyDown = useCallback((e, index) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        selectSlide(index > 0 ? index - 1 : slides.length - 1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        selectSlide(index < slides.length - 1 ? index + 1 : 0);
        break;
      case "Home":
        e.preventDefault();
        selectSlide(0);
        break;
      case "End":
        e.preventDefault();
        selectSlide(slides.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setActiveIndex(index);
        break;
      default:
        break;
    }
  }, [selectSlide, slides.length]);

  const handleImgError = useCallback((index) => {
    setImgError((prev) => ({ ...prev, [index]: true }));
  }, []);

  useEffect(() => {
    if (filmstripRef.current && thumbRefs.current[activeIndex]) {
      const thumb = thumbRefs.current[activeIndex];
      const filmstrip = filmstripRef.current;
      const thumbLeft = thumb.offsetLeft;
      const thumbWidth = thumb.offsetWidth;
      const filmstripWidth = filmstrip.offsetWidth;
      const scrollLeft = filmstrip.scrollLeft;

      if (thumbLeft < scrollLeft) {
        filmstrip.scrollTo({ left: thumbLeft - 16, behavior: prefersReducedMotion ? "auto" : "smooth" });
      } else if (thumbLeft + thumbWidth > scrollLeft + filmstripWidth) {
        filmstrip.scrollTo({ left: thumbLeft + thumbWidth - filmstripWidth + 16, behavior: prefersReducedMotion ? "auto" : "smooth" });
      }
    }
  }, [activeIndex, prefersReducedMotion]);

  return (
    <div className={`evidence-stage ${compact ? "evidence-stage-compact" : ""}`}>
      <a 
        href={deckUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="stage-main"
        aria-label="View full HD presentation"
      >
        {imgError[activeIndex] ? (
          <div className="stage-fallback">
            <span className="stage-fallback-alt">{slides[activeIndex].alt}</span>
          </div>
        ) : (
          <img
            src={slides[activeIndex].src}
            alt={slides[activeIndex].alt}
            className="stage-img"
            onError={() => handleImgError(activeIndex)}
          />
        )}
      </a>

      <div 
        className="stage-filmstrip" 
        ref={filmstripRef}
        role="listbox"
        aria-label="Presentation slides"
        aria-activedescendant={`slide-thumb-${activeIndex}`}
      >
        {slides.map((slide, i) => (
          <button
            key={i}
            ref={(el) => (thumbRefs.current[i] = el)}
            id={`slide-thumb-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            className={`stage-thumb ${i === activeIndex ? "stage-thumb-active" : ""}`}
            onClick={() => setActiveIndex(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            tabIndex={i === activeIndex ? 0 : -1}
          >
            {imgError[i] ? (
              <span className="thumb-fallback mono">{i + 1}</span>
            ) : (
              <img
                src={slide.src}
                alt=""
                aria-hidden="true"
                onError={() => handleImgError(i)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="stage-actions">
        <a 
          href={deckUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-stamp"
        >
          View HD Presentation
        </a>
        <a 
          href={pdfUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-ghost"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
