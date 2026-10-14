// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

/*
 * Aplica o tema salvo antes da primeira pintura, evitando o "flash" de tema
 * claro quando o usuário escolheu o escuro. A mesma chave ("theme") é usada
 * pelo componente ThemeToggle.
 */
const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="theme-color" content="#16305a" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
