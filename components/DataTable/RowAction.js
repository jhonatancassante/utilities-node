import Link from "next/link";
import styles from "./index.module.css";

export default function RowAction({ href, editable = false }) {
  return (
    <Link className={styles.actionLink} href={href}>
      <i
        className={"fas " + (editable ? "fa-edit" : "fa-eye")}
        aria-hidden="true"
      ></i>{" "}
      {editable ? "Editar" : "Visualizar"}
    </Link>
  );
}
