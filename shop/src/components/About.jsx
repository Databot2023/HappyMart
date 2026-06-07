import { useEffect, useRef } from "react";
import business from "../config/business";
import SectionHeading from "./ui/SectionHeading";
import "./About.css";

export default function About() {
  const imgRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );

    if (imgRef.current) obs.observe(imgRef.current);
    if (textRef.current) obs.observe(textRef.current);

    return () => obs.disconnect();
  }, []);

  return (
    <section id="about" className="section about">
      <div className="section-inner about__inner">
        <div className="about__image reveal" ref={imgRef}>
          <img
            src={business.aboutImage}
            alt="Happy Mart grocery storefront on NH 66 in Kochuvila"
            loading="lazy"
          />
        </div>
        <div className="about__text reveal" ref={textRef}>
          <SectionHeading
            eyebrow="About Us"
            title={`Your neighbourhood grocery store in ${business.location.city}`}
            align="left"
          />
          <p>{business.description}</p>
          <div className="about__details">
            <div className="about__detail-item">
              <span className="about__detail-label">Located at</span>
              <span>{business.location.address}</span>
            </div>
            <div className="about__detail-item">
              <span className="about__detail-label">Open</span>
              <span>Mon–Sat 9 AM – 9 PM · Sun 9 AM – 9:30 PM</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
