import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import { hasAdminAccess, hasAdminSectionAccess } from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const PAGE_SIZES = [10, 20, 50, 100];
const CSV_FIELDS = [
  "year", "decree",
  "sector_1", "sector_2", "sector_3", "sector_4", "sector_5", "sector_6", "sector_7", "sector_8", "sector_9", "sector_9a", "sector_10", "sector_11", "sector_11a", "sector_11b", "sector_12", "sector_13", "sector_14", "sector_15", "sector_16", "sector_17",
  "residential_precarious", "residential_simple", "residential_regular", "residential_medium", "residential_good", "residential_sophisticated",
  "commercial_precarious", "commercial_simple", "commercial_regular", "commercial_medium", "commercial_good", "commercial_sophisticated",
  "industrial_precarious", "industrial_simple", "industrial_regular", "industrial_medium", "industrial_good", "industrial_sophisticated",
  "cleaning", "garbage", "rural",
];
const COLUMNS = [
  { name: "year", label: "Ano" },
  { name: "decree", label: "Decreto" },
  { name: "cleaning", label: "Limpeza" },
  { name: "garbage", label: "Lixo" },
  { name: "rural", label: "Rural" },
];

function parseDelimitedText(source, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("O arquivo contém aspas não fechadas.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsvValue(field, rawValue, rowNumber) {
  const value = rawValue.trim();
  if (!value) return null;
  if (field === "decree") return value;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Linha " + rowNumber + ": valor inválido na coluna " + field + ".");
  if (field === "year") {
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9999) throw new Error("Linha " + rowNumber + ": o ano deve ser um inteiro entre 1 e 9999.");
    return parsed;
  }
  if (parsed > 9999999999.99 || Math.round(parsed * 100) / 100 !== parsed) throw new Error("Linha " + rowNumber + ": " + field + " aceita até duas casas decimais.");
  return parsed;
}

function AssessedValuesPage() {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [encoding, setEncoding] = useState("UTF-8");
  const [delimiter, setDelimiter] = useState(";");
  const [preview, setPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const canCreate = user?.features?.includes("create:assessed_values");
  const canUpdate = user?.features?.includes("update:assessed_values");
  const canDelete = user?.features?.includes("delete:assessed_values");

  useEffect(() => {
    if (!isLoading && !user && (!error || [401, 403].includes(error.statusCode))) router.replace("/login");
    if (!isLoading && user && !hasAdminSectionAccess(user, "assessed-values")) router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
  }, [error, isLoading, router, user]);

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const data = await requestAPI("/api/v1/admin/assessed-values");
      setRecords(data);
      setSelectedIds([]);
    } catch (requestError) {
      setFeedback({ type: "error", name: requestError.name, message: requestError.message, action: requestError.action });
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (user && hasAdminSectionAccess(user, "assessed-values")) loadRecords();
  }, [loadRecords, user]);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => String(record.year).includes(term) || String(record.decree || "").toLowerCase().includes(term));
  }, [records, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const visibleRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  function toggleSelection(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function togglePageSelection(checked) {
    const visibleIds = visibleRecords.map((record) => record.id);
    setSelectedIds((current) => checked ? Array.from(new Set([...current, ...visibleIds])) : current.filter((id) => !visibleIds.includes(id)));
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length || !window.confirm("Deseja excluir " + selectedIds.length + " registro(s) selecionado(s)?")) return;
    setIsDeleting(true);
    setFeedback(null);
    const results = await Promise.allSettled(selectedIds.map((id) =>
      requestAPI("/api/v1/admin/assessed-values/" + encodeURIComponent(id), { method: "DELETE" }),
    ));
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    await loadRecords();
    setFeedback({ type: failed ? "error" : "success", message: failed
      ? succeeded + " registro(s) excluído(s); " + failed + " não puderam ser excluídos."
      : succeeded + " registro(s) excluído(s) com sucesso." });
    setIsDeleting(false);
  }

  function handleDownloadTemplate() {
    const content = "\uFEFF" + CSV_FIELDS.join(";") + "\r\n";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-valores-venais.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleReadCsv() {
    if (!csvFile) { setFeedback({ type: "error", message: "Selecione um arquivo CSV antes de continuar." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseDelimitedText(String(reader.result || "").replace(/^\uFEFF/, ""), delimiter);
        if (rows.length < 2) throw new Error("O arquivo precisa conter cabeçalho e ao menos um registro.");
        const headers = rows[0].map((header) => header.trim().toLowerCase());
        const missing = CSV_FIELDS.filter((field) => !headers.includes(field));
        const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
        if (missing.length) throw new Error("Colunas ausentes: " + missing.join(", ") + ".");
        if (duplicates.length) throw new Error("O cabeçalho contém colunas duplicadas: " + Array.from(new Set(duplicates)).join(", ") + ".");
        if (rows.length - 1 > 500) throw new Error("O limite por importação é de 500 registros.");
        const indexes = Object.fromEntries(CSV_FIELDS.map((field) => [field, headers.indexOf(field)]));
        const parsedRecords = rows.slice(1).map((row, index) => {
          if (row.length !== headers.length) throw new Error("Linha " + (index + 2) + ": quantidade de colunas diferente do cabeçalho.");
          const record = {};
          for (const field of CSV_FIELDS) record[field] = parseCsvValue(field, row[indexes[field]], index + 2);
          if (record.year === null) throw new Error("Linha " + (index + 2) + ": o ano é obrigatório.");
          if (record.decree && record.decree.length > 12) throw new Error("Linha " + (index + 2) + ": o decreto deve ter até 12 caracteres.");
          return record;
        });
        setPreview({ records: parsedRecords, fileName: csvFile.name });
        setFeedback({ type: "success", message: parsedRecords.length + " registro(s) lido(s) e validados. Confira a prévia antes de importar." });
      } catch (parseError) {
        setPreview(null);
        setFeedback({ type: "error", message: parseError.message });
      }
    };
    reader.onerror = () => setFeedback({ type: "error", message: "Não foi possível ler o arquivo selecionado." });
    reader.readAsText(csvFile, encoding);
  }

  async function handleImport() {
    if (!preview || !preview.records.length) return;
    setIsImporting(true);
    setFeedback(null);
    try {
      const importedCount = preview.records.length;
      await requestAPI("/api/v1/admin/assessed-values/bulk", { method: "POST", body: JSON.stringify({ records: preview.records }) });
      setPreview(null);
      setCsvFile(null);
      await loadRecords();
      setFeedback({ type: "success", message: importedCount + " registro(s) importado(s) com sucesso." });
    } catch (requestError) {
      setFeedback({ type: "error", name: requestError.name, message: requestError.message, action: requestError.action });
    } finally {
      setIsImporting(false);
    }
  }

  if (isLoading || (!user && !error)) return <><AppHead title="Valores venais" /><Layout><main className={shared.container}><section className={shared.card}><p>Carregando permissões...</p></section></main></Layout></>;
  if (error) return <><AppHead title="Valores venais" /><Layout><main className={shared.container}><section className={shared.card}><StatusMessage type="critical" name={error.name} action={error.action}>{error.message}</StatusMessage></section></main></Layout></>;
  if (!user || !hasAdminSectionAccess(user, "assessed-values")) return null;

  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedIds.includes(record.id));

  return (
    <>
      <AppHead title="Valores venais" description="Gerencie a tabela anual de valores venais." />
      <Layout><main className={shared.container + " " + shared.containerUltraWide}>
        <section className={shared.card + " " + shared.cardUltraWide + " " + styles.card}>
          <AdminBackButton />
          <header className={styles.header}>
            <div className={shared.icon} aria-hidden="true"><i className="fas fa-calculator"></i></div>
            <span className={shared.badge}>ADMINISTRAÇÃO</span>
            <h1>Valores venais</h1>
            <p>Consulte e mantenha os valores venais de cada exercício, com suporte a cadastro individual e importação de planilhas CSV.</p>
          </header>
          {feedback && <div className={styles.feedback}><StatusMessage type={feedback.type === "success" ? "success" : "inline-error"} name={feedback.name} action={feedback.action}>{feedback.message}</StatusMessage></div>}
          <div className={styles.toolbar}>
            <label className={styles.searchField}><span className={shared.label}>Pesquisar por ano ou decreto</span>
              <input className={shared.input} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Ex.: 2026 ou 123/2026" />
            </label>
            {canCreate && <Link href="/admin/assessed-values/new" className={styles.linkButton}><i className="fas fa-plus" aria-hidden="true"></i> Novo cadastro</Link>}
          </div>
          {canCreate && <section className={styles.importSection}>
            <div className={styles.sectionTitle}><div><h2>Importar arquivo CSV</h2><p>Leia, valide e confira os registros antes de gravá-los no banco.</p></div><i className="fas fa-file-csv" aria-hidden="true"></i></div>
            <div className={styles.importControls}>
              <label className={styles.fileField}><span className={shared.label}>Arquivo CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => { setCsvFile(event.target.files?.[0] || null); setPreview(null); }} /></label>
              <label><span className={shared.label}>Codificação</span><select className={shared.input} value={encoding} onChange={(event) => setEncoding(event.target.value)}><option value="UTF-8">UTF-8</option><option value="windows-1252">Windows-1252</option><option value="ISO-8859-1">ISO-8859-1</option></select></label>
              <label><span className={shared.label}>Delimitador</span><select className={shared.input} value={delimiter} onChange={(event) => setDelimiter(event.target.value)}><option value=";">Ponto e vírgula (;)</option><option value=",">Vírgula (,)</option><option value={"\t"}>Tabulação</option><option value="|">Barra vertical (|)</option></select></label>
            </div>
            <div className={styles.importActions}>
              <Button type="button" variant="outline" icon="fa-download" onClick={handleDownloadTemplate} disabled={isImporting}>Baixar modelo CSV</Button>
              <Button type="button" variant="outline" icon="fa-eye" onClick={handleReadCsv} disabled={!csvFile || isImporting}>Ler e validar CSV</Button>
              {preview && <Button type="button" icon="fa-file-import" onClick={handleImport} disabled={isImporting}>{isImporting ? "Importando..." : "Importar " + preview.records.length + " registro(s)"}</Button>}
            </div>
            {preview && <div className={styles.preview}>
              <div className={styles.previewHeading}><strong>Prévia: {preview.fileName}</strong><span>{preview.records.length} registro(s) validados</span></div>
              <p>Os dados abaixo são uma amostra. Todos os registros foram validados antes da importação.</p>
              <div className={styles.tableWrapper}><table><thead><tr>{COLUMNS.map((column) => <th key={column.name}>{column.label}</th>)}</tr></thead><tbody>{preview.records.slice(0, 5).map((record, index) => <tr key={index}>{COLUMNS.map((column) => <td key={column.name}>{record[column.name] ?? "—"}</td>)}</tr>)}</tbody></table></div>
              {preview.records.length > 5 && <small>Exibindo os primeiros 5 registros de {preview.records.length}.</small>}
            </div>}
          </section>}
          <section className={styles.results}>
            <div className={styles.resultsHeading}><div><h2>Registros cadastrados</h2><span>{filteredRecords.length} registro(s)</span></div>
              {canDelete && selectedIds.length > 0 && <Button type="button" variant="danger" icon="fa-trash" onClick={handleDeleteSelected} disabled={isDeleting}>{isDeleting ? "Excluindo..." : "Excluir selecionados (" + selectedIds.length + ")"}</Button>}
            </div>
            {isLoadingRecords ? <p className={styles.empty}>Carregando registros...</p> : filteredRecords.length === 0 ? <p className={styles.empty}>Nenhum registro encontrado.</p> : <>
              <div className={styles.tableWrapper}><table><thead><tr>
                {canDelete && <th><input type="checkbox" aria-label="Selecionar todos desta página" checked={allVisibleSelected} onChange={(event) => togglePageSelection(event.target.checked)} /></th>}
                {COLUMNS.map((column) => <th key={column.name}>{column.label}</th>)}<th>Última atualização</th><th>Ações</th>
              </tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}>
                {canDelete && <td><input type="checkbox" aria-label={"Selecionar ano " + record.year} checked={selectedIds.includes(record.id)} onChange={() => toggleSelection(record.id)} /></td>}
                <td><strong>{record.year}</strong></td><td>{record.decree || "—"}</td><td>{record.cleaning ?? "—"}</td><td>{record.garbage ?? "—"}</td><td>{record.rural ?? "—"}</td>
                <td>{record.updated_at ? new Date(record.updated_at).toLocaleDateString("pt-BR") : "—"}</td>
                <td><Link className={styles.actionLink} href={"/admin/assessed-values/" + record.id}><i className={"fas " + (canUpdate ? "fa-edit" : "fa-eye")} aria-hidden="true"></i> {canUpdate ? "Editar" : "Visualizar"}</Link></td>
              </tr>)}</tbody></table></div>
              <div className={styles.pagination}>
                <label>Registros por página <select className={shared.input} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{PAGE_SIZES.map((size) => <option value={size} key={size}>{size}</option>)}</select></label>
                <div><span>Página {page} de {pageCount}</span><Button variant="outline" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</Button><Button variant="outline" type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Próxima</Button></div>
              </div>
            </>}
          </section>
        </section>
      </main></Layout>
    </>
  );
}
export default AssessedValuesPage;
