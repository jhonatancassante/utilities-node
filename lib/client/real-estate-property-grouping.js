export default function getGroupingIssues(records) {
  const groups = new Map();

  records.forEach((record) => {
    const ctm = String(record.ctm ?? "").replace(/\\D/g, "");
    if (!groups.has(ctm)) groups.set(ctm, []);
    groups.get(ctm).push(record);
  });

  return Array.from(groups.entries())
    .map(([ctm, properties]) => {
      const issues = [];
      const hasIndividual = properties.some((property) => property.grouping === "I");
      const hasEnglobed = properties.some((property) => ["P", "A"].includes(property.grouping));
      const principals = properties.filter((property) => property.grouping === "P");

      if (properties.some((property) => !["I", "P", "A"].includes(property.grouping))) {
        issues.push("Há cadastro com classificação diferente de I, P ou A.");
      }
      if (hasIndividual && hasEnglobed) {
        issues.push("O CTM mistura cadastros individuais (I) com cadastros englobados (P/A).");
      }
      if (hasEnglobed) {
        if (principals.length !== 1) {
          issues.push("O conjunto deve possuir exatamente um cadastro principal (P).");
        }
        properties.forEach((property) => {
          const isMainRegistration = String(property.physical_registration ?? "").trim().endsWith(".01");
          if (isMainRegistration && property.grouping === "A") {
            issues.push("O cadastro terminado em .01 não pode estar classificado como agregado (A).");
          }
          if (!isMainRegistration && property.grouping === "P") {
            issues.push("Somente o cadastro terminado em .01 pode ser principal (P).");
          }
        });
      }

      return { ctm, properties, issues: Array.from(new Set(issues)) };
    })
    .filter((group) => group.issues.length > 0);
}
