// components/Layout/index.js
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./index.module.css";

function Layout({ title, icon, backHref, children }) {
  return (
    <div className={styles.page}>
      <Header title={title} icon={icon} backHref={backHref} />
      {children}
      <Footer />
    </div>
  );
}

export default Layout;
