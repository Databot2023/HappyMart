import { useEffect, useRef } from "react";
import business from "../config/business";
import Button from "./ui/Button";
import "./Hero.css";

export default function Hero() {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section id="hero" className="hero">
      <div className="hero__bg">
        <img
          src={business.heroImage}
          alt=""
          aria-hidden="true"
        />
        <div className="hero__overlay" />
      </div>

      <div ref={contentRef} className="hero__content reveal visible">
        <span className="eyebrow">
          {business.location.city} &mdash; {business.businessType}
        </span>
        <h1>{business.name}</h1>
        <p className="hero__subtitle">
          {business.tagline} &mdash; your neighbourhood stop for fresh groceries, daily essentials, and a warm smile.
        </p>

        <div className="hero__actions">
          <Button
            href={business.ctas.primary.href}
            variant="primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            {business.ctas.primary.text}
          </Button>
          <Button href={business.ctas.secondary.href} variant="secondary">
            {business.ctas.secondary.text}
          </Button>
          <Button
            href={`https://wa.me/${business.whatsapp}`}
            variant="secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </Button>
        </div>

        <div className="hero__trust">
          <span>Open today until {business.hours[0].time.split(' – ')[1]}</span>
          <span className="hero__trust-divider" />
          <span>{business.location.area}</span>
        </div>
      </div>
    </section>
  );
}
