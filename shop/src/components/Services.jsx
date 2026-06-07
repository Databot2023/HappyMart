import business from "../config/business";
import SectionHeading from "./ui/SectionHeading";
import ServiceCard from "./ui/ServiceCard";
import "./Services.css";

export default function Services() {
  return (
    <section id="services" className="section services">
      <div className="section-inner">
        <SectionHeading
          eyebrow="What We Offer"
          title="Everything you need for your day-to-day"
        />
        <div className="services__grid">
          {business.services.map((service, index) => (
            <ServiceCard key={service.title} {...service} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
