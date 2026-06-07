import { useEffect, useRef } from "react";
import business from "../config/business";
import SectionHeading from "./ui/SectionHeading";
import "./WhyChooseUs.css";

export default function WhyChooseUs() {
  const itemsRef = useRef([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.index);
            entry.target.style.transitionDelay = `${index * 100}ms`;
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.2 }
    );

    itemsRef.current.forEach((el) => {
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, []);

  return (
    <section id="why-choose-us" className="section why-choose-us">
      <div className="section-inner">
        <SectionHeading
          eyebrow="Why Choose Us"
          title="The neighbourhood stop you can count on"
        />
        <div className="why-choose-us__grid">
          {business.usps.map((usp, index) => (
            <div
              key={usp.title}
              className="why-choose-us__item reveal"
              ref={(el) => (itemsRef.current[index] = el)}
              data-index={index}
            >
              <span className="why-choose-us__icon">{usp.icon}</span>
              <h3 className="why-choose-us__title">{usp.title}</h3>
              <p className="why-choose-us__desc">{usp.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
