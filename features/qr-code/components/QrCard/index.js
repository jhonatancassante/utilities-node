// features/qr-code/components/QrCard/index.js
import { QRCodeCanvas } from "qrcode.react";
import styles from "./index.module.css";

const QR_SIZE = 260;

// `ref` aponta para o container inteiro: é ele que vira a imagem baixada.
function QrCard({ ref, value, colors }) {
  return (
    <div className={styles.container} ref={ref}>
      {/* Fundo sempre branco por fora do QR: mantém a leitura em qualquer tema. */}
      <div className={styles.border} style={{ borderColor: colors.border }}>
        <QRCodeCanvas
          value={value}
          size={QR_SIZE}
          level="H"
          marginSize={0}
          fgColor={colors.qr}
          bgColor={colors.bg}
          title={`QR Code para ${value}`}
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      <div
        className={styles.footer}
        style={{ backgroundColor: colors.border, color: colors.text }}
      >
        <i className="fas fa-mobile-alt" aria-hidden="true"></i>
        <span>Escaneie-me</span>
      </div>
    </div>
  );
}

export default QrCard;
