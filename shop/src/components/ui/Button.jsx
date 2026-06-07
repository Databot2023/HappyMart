import "./Button.css";

export default function Button({ children, href, variant = "primary", className = "", ...props }) {
  const classes = `btn btn--${variant} ${className}`.trim();

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
