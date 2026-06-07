import { useState, useEffect, useRef } from "react";
import business from "../config/business";
import SectionHeading from "./ui/SectionHeading";
import Button from "./ui/Button";
import "./Contact.css";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          document.querySelectorAll(".contact__column").forEach((el, i) => {
            el.style.transitionDelay = `${i * 150}ms`;
            el.classList.add("visible");
          });
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="section contact" ref={sectionRef}>
      <div className="section-inner">
        <SectionHeading
          eyebrow="Get in Touch"
          title="Come by or give us a call"
        />

        <div className="contact__grid">
          <div className="contact__column reveal">
            <div className="contact__info">
              <div className="contact__info-item">
                <h3>Address</h3>
                <p>{business.location.address}</p>
                <Button
                  href={business.location.googleMapsLink}
                  variant="secondary"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact__directions-btn"
                >
                  Get Directions
                </Button>
              </div>

              <div className="contact__info-item">
                <h3>Hours</h3>
                <ul className="contact__hours">
                  {business.hours.map((h) => (
                    <li key={h.day} className="contact__hours-row">
                      <span className="contact__hours-day">{h.day}</span>
                      <span className="contact__hours-time">{h.time}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="contact__info-item">
                <h3>Contact</h3>
                <div className="contact__actions">
                  <Button href={`tel:${business.phone}`} variant="primary">
                    Call {business.phone}
                  </Button>
                  {business.whatsapp && (
                    <Button
                      href={`https://wa.me/${business.whatsapp}`}
                      variant="secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="contact__column reveal">
            <form className="contact__form" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="contact__form-success">
                  <span className="contact__form-success-icon">✓</span>
                  <p><strong>Your message has been noted.</strong> Since this is a demo, nothing was sent — but you can reach us directly by phone or WhatsApp for the fastest response.</p>
                </div>
              ) : (
                <>
                  <div className="contact__form-group">
                    <label htmlFor="name">Your Name</label>
                    <input
                      type="text"
                      id="name"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="contact__form-group">
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      rows={4}
                      placeholder="How can we help?"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" variant="primary">
                    Send Message
                  </Button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
