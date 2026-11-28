import styles from "./index.module.css";

// Mensagem de erro de preenchimento, exibida logo abaixo do campo inválido.
// Use junto de `aria-invalid` e `aria-describedby={id}` no campo.
function FieldError({ id, children }) {
  if (!children) {
    return null;
  }

  return (
    <small className={styles.fieldError} id={id} role="alert">
      {children}
    </small>
  );
}

export default FieldError;
