import "./SectionHeading.css";

export default function SectionHeading({ eyebrow, title, align = "center" }) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
    </div>
  );
}
