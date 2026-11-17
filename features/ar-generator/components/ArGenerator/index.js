// features/ar-generator/components/ArGenerator/index.js
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import HelpToggle from "@/components/HelpToggle";
import StatusMessage from "@/components/StatusMessage";
import { downloadBlob } from "@/lib/files.js";
import { generateArPdf } from "../../lib/pdf.js";
import styles from "./index.module.css";

const DEFAULT_SENDER = {
  nome: "MUNICÍPIO DE NOVA ODESSA - SETOR DE TRIBUTAÇÃO E DÍVIDA ATIVA",
  cep: "13380-017", endereco: "AVENIDA JOÃO PESSOA", numero: "777",
  complemento: "", bairro: "CENTRO", uf: "SP", cidade: "Nova Odessa",
};
const EMPTY = {
  cep: "", nome: "", endereco: "", numero: "", complemento: "",
  bairro: "", uf: "", cidade: "", observacao: "",
};
const IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";

function AddressFields({ value, setValue, prefix, ufs, cities, onUfChange, onCepBlur, observation = false }) {
  const update = (field, next) => setValue((current) => ({ ...current, [field]: next }));
  const input = (field, label, required = true, maxLength = 65) => (
    <label className={styles.field} key={field}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        name={`${prefix}-${field}`}
        value={value[field] ?? ""}
        required={required}
        maxLength={maxLength}
        inputMode={field === "cep" || field === "numero" ? "numeric" : undefined}
        onChange={(event) => {
          let next = event.target.value;
          if (field === "cep") next = next.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
          if (field === "numero") next = next.replace(/\D/g, "").slice(0, 8);
          update(field, next);
        }}
        onBlur={field === "cep" ? onCepBlur : undefined}
      />
    </label>
  );
  return (
    <div className={styles.formGrid}>
      {input("cep", "CEP", true, 9)}
      {input("nome", "Nome / Empresa", true, 65)}
      {input("endereco", "Endereço", true, 50)}
      {input("numero", "Número", true, 8)}
      {input("complemento", "Complemento", false, 50)}
      {input("bairro", "Bairro", true, 50)}
      <label className={styles.field}>
        <span>UF *</span>
        <select required value={value.uf} onChange={(event) => onUfChange(event.target.value)}>
          <option value="">Selecione...</option>
          {ufs.map((uf) => <option key={uf.sigla} value={uf.sigla}>{uf.sigla}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span>Cidade *</span>
        <select required disabled={!value.uf || !cities.length} value={value.cidade} onChange={(event) => update("cidade", event.target.value)}>
          <option value="">{value.uf ? "Selecione a cidade..." : "Selecione a UF primeiro"}</option>
          {cities.map((city) => <option key={city.id} value={city.nome}>{city.nome}</option>)}
        </select>
      </label>
      {observation && input("observacao", "Observação", false, 60)}
    </div>
  );
}

export default function ArGenerator() {
  const [tab, setTab] = useState("recipient");
  const [recipient, setRecipient] = useState(EMPTY);
  const [sender, setSender] = useState(DEFAULT_SENDER);
  const [records, setRecords] = useState([]);
  const [includeSenderLabels, setIncludeSenderLabels] = useState(false);
  const [ufs, setUfs] = useState([]);
  const [recipientCities, setRecipientCities] = useState([]);
  const [senderCities, setSenderCities] = useState([]);
  const [logoBytes, setLogoBytes] = useState(null);
  const [status, setStatus] = useState({ type: "info", message: "" });
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${IBGE}?orderBy=nome`)
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (active) setUfs(data); })
      .catch(() => { if (active) setStatus({ type: "error", message: "Não foi possível carregar as UFs do IBGE." }); });
    fetch("/assets/logo_correios.gif")
      .then((response) => response.ok ? response.arrayBuffer() : null)
      .then((bytes) => { if (active && bytes) setLogoBytes(new Uint8Array(bytes)); })
      .catch(() => {});
    fetch(`${IBGE}/SP/municipios?orderBy=nome`)
      .then((response) => response.ok ? response.json() : [])
      .then((data) => { if (active) setSenderCities(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  async function fetchCities(uf, setter) {
    if (!uf) { setter([]); return; }
    try {
      const response = await fetch(`${IBGE}/${uf}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error();
      setter(await response.json());
    } catch {
      setStatus({ type: "error", message: "Não foi possível carregar as cidades dessa UF." });
    }
  }

  function changeUf(kind, uf) {
    const setter = kind === "recipient" ? setRecipient : setSender;
    const citySetter = kind === "recipient" ? setRecipientCities : setSenderCities;
    setter((current) => ({ ...current, uf, cidade: "" }));
    fetchCities(uf, citySetter);
  }

  async function lookupCep(kind) {
    const data = kind === "recipient" ? recipient : sender;
    const setter = kind === "recipient" ? setRecipient : setSender;
    const citySetter = kind === "recipient" ? setRecipientCities : setSenderCities;
    const cep = data.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.erro) {
        setStatus({ type: "error", message: "CEP não encontrado na base do ViaCEP." });
        return;
      }
      setter((current) => ({
        ...current,
        endereco: result.logradouro || current.endereco,
        bairro: result.bairro || current.bairro,
        complemento: current.complemento || result.complemento || "",
        uf: result.uf || current.uf,
        cidade: result.localidade || current.cidade,
      }));
      if (result.uf) await fetchCities(result.uf, citySetter);
      setStatus({ type: "info", message: "" });
    } catch {
      setStatus({ type: "error", message: "Não foi possível consultar o CEP. Tente novamente." });
    }
  }

  function addRecord(event) {
    event.preventDefault();
    const senderForm = document.getElementById("sender-form");
    if (!senderForm?.checkValidity()) {
      setTab("sender");
      window.requestAnimationFrame(() => senderForm?.reportValidity());
      return;
    }
    setRecords((current) => [...current, { ...recipient, remetente: { ...sender } }]);
    setRecipient(EMPTY);
    setRecipientCities([]);
    setStatus({ type: "success", message: "Destinatário incluído na lista." });
  }

  async function printPdf() {
    if (!records.length || busy) return;
    setBusy(true);
    setStatus({ type: "info", message: "Gerando ARs e etiquetas no navegador..." });
    try {
      const result = await generateArPdf(records, includeSenderLabels, logoBytes);
      downloadBlob(new Blob([result.bytes], { type: "application/pdf" }), result.filename);
      setStatus({ type: "success", message: `PDF gerado: ${result.filename}` });
    } catch {
      setStatus({ type: "error", message: "Não foi possível gerar o PDF. Confira os dados e tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  function clearRecords() {
    if (!confirmClear) { setConfirmClear(true); return; }
    setRecords([]);
    setRecipient(EMPTY);
    setRecipientCities([]);
    setIncludeSenderLabels(false);
    setConfirmClear(false);
    setStatus({ type: "info", message: "Lista de destinatários limpa." });
  }

  return (
    <div className={styles.wrapper}>
      <HelpToggle>
        <strong>Como funciona:</strong> cadastre os destinatários e os dados do remetente. Cada registro guarda uma cópia do remetente vigente no momento da inclusão. O PDF contém dois ARs por página A4 e, em páginas separadas, etiquetas de endereçamento. A geração ocorre no navegador; as consultas de CEP e localidades utilizam ViaCEP e IBGE.
      </HelpToggle>
      <div className={styles.tabs} role="tablist" aria-label="Dados do aviso de recebimento">
        <button type="button" role="tab" id="tab-recipient" aria-controls="recipient-panel" aria-selected={tab === "recipient"} tabIndex={tab === "recipient" ? 0 : -1} onClick={() => setTab("recipient")} onKeyDown={(event) => {
          if (event.key === "ArrowRight") { event.preventDefault(); setTab("sender"); document.getElementById("tab-sender")?.focus(); }
        }}>Destinatário</button>
        <button type="button" role="tab" id="tab-sender" aria-controls="sender-panel" aria-selected={tab === "sender"} tabIndex={tab === "sender" ? 0 : -1} onClick={() => setTab("sender")} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); setTab("recipient"); document.getElementById("tab-recipient")?.focus(); }
        }}>Remetente</button>
      </div>
      <form id="recipient-form" onSubmit={addRecord} hidden={tab !== "recipient"}>
        <div id="recipient-panel" role="tabpanel" aria-labelledby="tab-recipient">
          <AddressFields value={recipient} setValue={setRecipient} prefix="recipient" ufs={ufs} cities={recipientCities} onUfChange={(uf) => changeUf("recipient", uf)} onCepBlur={() => lookupCep("recipient")} observation />
          <div className={styles.actions}><Button type="submit" icon="fa-plus">Incluir destinatário</Button></div>
        </div>
      </form>
      <form id="sender-form" onSubmit={(event) => event.preventDefault()} hidden={tab !== "sender"}>
        <div id="sender-panel" role="tabpanel" aria-labelledby="tab-sender">
          <AddressFields value={sender} setValue={setSender} prefix="sender" ufs={ufs} cities={senderCities} onUfChange={(uf) => changeUf("sender", uf)} onCepBlur={() => lookupCep("sender")} />
          <div className={styles.actions}><Button type="button" variant="danger" icon="fa-undo" onClick={() => {
            setSender(DEFAULT_SENDER);
            fetchCities("SP", setSenderCities);
          }}>Restaurar remetente padrão</Button></div>
        </div>
      </form>
      {records.length > 0 && (
        <section className={styles.tableSection}>
          <h2>Destinatários cadastrados ({records.length})</h2>
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th>Nome</th><th>Endereço</th><th>Bairro</th><th>Cidade/UF</th><th>CEP</th><th>Observação</th><th>Ações</th></tr></thead>
              <tbody>{records.map((record, index) => (
                <tr key={`${record.cep}-${index}`}>
                  <td>{record.nome}</td><td>{record.endereco}, {record.numero}{record.complemento ? ` (${record.complemento})` : ""}</td><td>{record.bairro}</td><td>{record.cidade}/{record.uf}</td><td>{record.cep}</td><td>{record.observacao || "—"}</td>
                  <td><button type="button" className={styles.deleteButton} aria-label={`Excluir ${record.nome}`} onClick={() => setRecords((current) => current.filter((_, i) => i !== index))}><i className="fas fa-trash-alt" aria-hidden="true"></i></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <label className={styles.switchRow}>
            <span>Incluir etiqueta com os dados do remetente?</span>
            <input type="checkbox" role="switch" checked={includeSenderLabels} onChange={(event) => setIncludeSenderLabels(event.target.checked)} />
            <strong>{includeSenderLabels ? "Sim" : "Não"}</strong>
          </label>
          <div className={styles.actions}>
            <Button icon="fa-file-pdf" onClick={printPdf} disabled={busy}>{busy ? "Gerando PDF..." : "Gerar PDF"}</Button>
            <Button variant="danger" icon="fa-trash-alt" onClick={clearRecords}>{confirmClear ? "Confirmar limpeza" : "Limpar tudo"}</Button>
          </div>
        </section>
      )}
      <StatusMessage type={status.type}>{status.message}</StatusMessage>
    </div>
  );
}
