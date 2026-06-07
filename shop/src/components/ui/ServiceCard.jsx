import { useEffect, useRef } from "react";
import "./ServiceCard.css";

export default function ServiceCard({ title, description, image, alt, index }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${(index || 0) * 120}ms`;
          el.classList.add("visible");
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <article ref={cardRef} className="service-card reveal">
      <div className="service-card__image-wrapper">
        <img src={image} alt={alt || title} loading="lazy" />
        <div className="service-card__overlay" />
      </div>
      <div className="service-card__content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}
