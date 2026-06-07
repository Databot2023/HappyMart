import { useState, useEffect, useRef } from "react";
import business from "../config/business";
import SectionHeading from "./ui/SectionHeading";
import "./Faq.css";

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          document.querySelectorAll(".faq__item").forEach((el, i) => {
            el.style.transitionDelay = `${i * 80}ms`;
            el.classList.add("visible");
          });
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  if (!business.faq || business.faq.length === 0) return null;

  return (
    <section id="faq" className="section faq" ref={sectionRef}>
      <div className="section-inner">
        <SectionHeading
          eyebrow="FAQ"
          title="Quick answers to common questions"
        />
        <div className="faq__list">
          {business.faq.map((item, index) => (
            <div
              key={index}
              className={`faq__item reveal ${openIndex === index ? "faq__item--open" : ""}`}
            >
              <button
                className="faq__question"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
              >
                <span>{item.question}</span>
                <span className="faq__icon" aria-hidden="true">
                  {openIndex === index ? "−" : "+"}
                </span>
              </button>
              <div
                className="faq__answer"
                style={{
                  maxHeight: openIndex === index ? "300px" : "0",
                  opacity: openIndex === index ? 1 : 0,
                }}
              >
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
