// components/Button/index.js
import styles from "./index.module.css";

const VARIANT_CLASS = {
  primary: styles.primary,
  danger: styles.danger,
};

function Button({
  variant = "primary",
  icon,
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`${styles.button} ${VARIANT_CLASS[variant] ?? styles.primary}`}
      {...props}
    >
      {icon && <i className={`fas ${icon}`} aria-hidden="true"></i>}
      {children}
    </button>
  );
}

export default Button;
