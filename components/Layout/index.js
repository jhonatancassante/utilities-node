// components/Layout/index.js
import Breadcrumb from "@/components/Breadcrumb";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./index.module.css";

function Layout({ children }) {
  return (
    <div className={styles.page}>
      <Header />
      <Breadcrumb />
      {children}
      <Footer />
    </div>
  );
}

export default Layout;
