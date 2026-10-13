import Head from "next/head";
import siteConfigs from "@/configs/site.js";

function AppHead({
  title,
  description = siteConfigs.defaultDescription,
  children,
}) {
  const fullTitle = title
    ? `${siteConfigs.appName} ${siteConfigs.titleSeparator} ${title}`
    : siteConfigs.appName;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {children}
    </Head>
  );
}

export default AppHead;
