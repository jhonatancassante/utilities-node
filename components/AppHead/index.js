import Head from "next/head";
import headConfigs from "@/configs/head.js";

function AppHead({
  title,
  description = headConfigs.defaultDescription,
  children,
}) {
  const fullTitle = title
    ? `${headConfigs.appName} ${headConfigs.titleSeparator} ${title}`
    : headConfigs.appName;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {children}
    </Head>
  );
}

export default AppHead;
