import business from "../config/business";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="section-inner footer__inner">
        <div className="footer__brand">
          <a href="#hero" className="footer__logo">
            {business.name}
          </a>
          <p className="footer__tagline">{business.tagline}</p>
        </div>

        <div className="footer__links">
          <div className="footer__column">
            <h4>Contact</h4>
            <a href={`tel:${business.phone}`}>{business.phone}</a>
            {business.whatsapp && (
              <a
                href={`https://wa.me/${business.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            )}
          </div>
          <div className="footer__column">
            <h4>Location</h4>
            <p>{business.location.address}</p>
            <a
              href={business.location.googleMapsLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Directions
            </a>
          </div>
          <div className="footer__column">
            <h4>Hours</h4>
            {business.hours.map((h) => (
              <p key={h.day}>
                {h.day}: {h.time}
              </p>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <p>&copy; {year} {business.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
