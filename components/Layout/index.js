// components/Layout/index.js
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./index.module.css";

function Layout({ children }) {
  return (
    <div className={styles.page}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}

export default Layout;
