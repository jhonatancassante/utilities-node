// features/qr-code/components/ColorField/index.js
import styles from "./index.module.css";

function ColorField({ id, label, value, onChange }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span
        className={styles.preview}
        style={{ backgroundColor: value }}
        aria-hidden="true"
      ></span>
    </div>
  );
}

export default ColorField;
