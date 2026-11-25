import { useEffect, useState } from "react";
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

const SECTIONS = [
  { title: "Identificação do imóvel", description: "Códigos e inscrições utilizados para localizar o cadastro.", fields: [
    { name: "year", label: "Ano", type: "integer", required: true, width: "quarter" },
    { name: "physical_property_id", label: "Código do imóvel", type: "integer", required: true, width: "quarter" },
    { name: "physical_registration", label: "Inscrição física", type: "registration", required: true, width: "half" },
    { name: "ctm", label: "CTM", type: "ctm", required: true, width: "half" },
    { name: "ctm_count", label: "Contador CTM", type: "integer", required: true, width: "quarter" },
    { name: "grouping", label: "Agrupamento", required: true, maxLength: 1, width: "quarter" },
  ]},
  { title: "Localização", description: "Endereço e identificação territorial do imóvel.", fields: [
    { name: "property_street", label: "Logradouro", required: true, maxLength: 100, width: "half" },
    { name: "property_number", label: "Número", type: "decimal", nullable: true, width: "quarter" },
    { name: "property_complement", label: "Complemento", nullable: true, maxLength: 100, width: "quarter" },
    { name: "property_neighborhood", label: "Bairro", required: true, maxLength: 50, width: "half" },
    { name: "property_block", label: "Quadra", nullable: true, maxLength: 20, width: "quarter" },
    { name: "property_lots", label: "Lote", nullable: true, maxLength: 20, width: "quarter" },
    { name: "land_sector", label: "Setor do terreno", type: "integer", required: true, width: "quarter" },
  ]},
  { title: "Áreas e características", description: "Dimensões e características físicas cadastradas.", fields: [
    { name: "land_area", label: "Área do terreno (m²)", type: "decimal", required: true, width: "third" },
    { name: "built_area", label: "Área construída (m²)", type: "decimal", nullable: true, width: "third" },
    { name: "construction_type", label: "Tipo de construção", type: "integer", nullable: true, width: "third" },
    { name: "ideal_fraction", label: "Fração ideal", type: "decimal", nullable: true, width: "third" },
    { name: "points", label: "Pontuação", type: "integer", nullable: true, width: "third" },
  ]},
  { title: "Responsáveis", description: "Titularidade e compromisso de compra, quando houver.", fields: [
    { name: "owner_name", label: "Proprietário", required: true, maxLength: 100, width: "half" },
    { name: "promissory_buyer", label: "Compromissário comprador", nullable: true, maxLength: 100, width: "half" },
  ]},
];

function digitsOnly(value) { return String(value ?? "").replace(/\D/g, ""); }
function formatRegistration(value) {
  const digits = digitsOnly(value).slice(0, 15);
  return [digits.slice(0, 2), digits.slice(2, 7), digits.slice(7, 11), digits.slice(11, 15)].filter(Boolean).join(".");
}
function formatCtm(value) {
  const digits = digitsOnly(value).slice(0, 11);
  return [digits.slice(0, 2), digits.slice(2, 7), digits.slice(7, 11)].filter(Boolean).join(".");
}
function decimalDisplay(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2).replace(".", ",") : "";
}
function maskDecimal(value) {
  const digits = digitsOnly(value).slice(0, 12);
  if (!digits) return "";
  const cents = digits.slice(-2).padStart(2, "0");
  const integer = digits.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  return integer + "," + cents;
}
function initialForm(record) {
  return {
    year: String(record?.year ?? new Date().getFullYear()),
    physical_property_id: String(record?.physical_property_id ?? ""),
    physical_registration: formatRegistration(record?.physical_registration),
    ctm: formatCtm(record?.ctm),
    ctm_count: String(record?.ctm_count ?? ""),
    grouping: record?.grouping ?? "",
    property_block: record?.property_block ?? "",
    property_lots: record?.property_lots ?? "",
    land_area: decimalDisplay(record?.land_area),
    built_area: decimalDisplay(record?.built_area ?? 0),
    property_neighborhood: record?.property_neighborhood ?? "",
    owner_name: record?.owner_name ?? "",
    promissory_buyer: record?.promissory_buyer ?? "",
    land_sector: String(record?.land_sector ?? ""),
    property_street: record?.property_street ?? "",
    property_number: decimalDisplay(record?.property_number),
    property_complement: record?.property_complement ?? "",
    construction_type: String(record?.construction_type ?? ""),
    ideal_fraction: decimalDisplay(record?.ideal_fraction),
    points: String(record?.points ?? ""),
    annual: record?.annual ?? false,
  };
}
function RealEstatePropertyEditor({ recordId }) {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(() => initialForm(null));
  const [isLoadingRecord, setIsLoadingRecord] = useState(Boolean(recordId));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const isEditing = Boolean(recordId);
  const requiredFeature = isEditing ? "read:real_estate_properties" : "create:real_estate_properties";
  const canUpdate = user?.features?.includes("update:real_estate_properties");

  useEffect(() => {
    if (!isLoading && !user && (!error || [401, 403].includes(error.statusCode))) router.replace("/login");
    if (!isLoading && user && !hasAdminSectionAccess(user, "real-estate-properties")) router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    if (!isLoading && user && !user.features.includes(requiredFeature)) router.replace("/admin/real-estate-properties");
  }, [error, isLoading, requiredFeature, router, user]);

  useEffect(() => {
    if (!recordId || !user || !hasAdminSectionAccess(user, "real-estate-properties")) return undefined;
    let active = true;
    requestAPI("/api/v1/admin/real-estate-properties/" + encodeURIComponent(recordId))
      .then((data) => { if (active) { setRecord(data); setForm(initialForm(data)); } })
      .catch((requestError) => {
        if (active) setFeedback({ type: "error", name: requestError.name, message: requestError.message, action: requestError.action });
      })
      .finally(() => { if (active) setIsLoadingRecord(false); });
    return () => { active = false; };
  }, [recordId, user]);

  function updateField(name, value, type) {
    let next = value;
    if (type === "registration") next = formatRegistration(value);
    if (type === "ctm") next = formatCtm(value);
    if (type === "decimal") next = maskDecimal(value);
    setForm((current) => ({ ...current, [name]: next }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);
    const registrationDigits = digitsOnly(form.physical_registration);
    if (![13, 14, 15].includes(registrationDigits.length)) {
      setFeedback({ type: "error", message: "A inscrição física deve seguir um dos formatos 12.12345.1234.12, 12.12345.1234.123 ou 12.12345.1234.1234." });
      return;
    }
    if (digitsOnly(form.ctm).length !== 11) {
      setFeedback({ type: "error", message: "O CTM deve conter 11 dígitos, no formato 12.12345.1234." });
      return;
    }
    const payload = {};
    for (const section of SECTIONS) {
      for (const field of section.fields) {
        const raw = String(form[field.name] ?? "").trim();
        if (!raw && field.nullable) { payload[field.name] = null; continue; }
        if (!raw && field.required) {
          setFeedback({ type: "error", message: "Preencha o campo " + field.label + "." });
          return;
        }
        if (!raw) continue;
        if (field.type === "registration" || field.type === "ctm") payload[field.name] = digitsOnly(raw);
        else if (field.type === "decimal") {
          const number = Number(raw.replace(",", "."));
          if (!Number.isFinite(number) || Math.round(number * 100) / 100 !== number) {
            setFeedback({ type: "error", message: "Informe um valor válido no campo " + field.label + "." });
            return;
          }
          payload[field.name] = number;
        } else if (field.type === "integer") {
          const number = Number(raw);
          if (!Number.isInteger(number) || number < 0) {
            setFeedback({ type: "error", message: "Informe um número inteiro válido no campo " + field.label + "." });
            return;
          }
          payload[field.name] = number;
        } else payload[field.name] = raw;
      }
    }
    payload.annual = Boolean(form.annual);
    setIsSaving(true);
    try {
      await requestAPI(
        isEditing ? "/api/v1/admin/real-estate-properties/" + encodeURIComponent(recordId) : "/api/v1/admin/real-estate-properties",
        { method: isEditing ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      router.push("/admin/real-estate-properties");
    } catch (requestError) {
      setFeedback({ type: "error", name: requestError.name, message: requestError.message, action: requestError.action });
    } finally { setIsSaving(false); }
  }

  const title = isEditing ? (canUpdate ? "Editar imóvel" : "Consultar imóvel") : "Cadastrar imóvel";
  if (isLoading || (!user && !error) || (isEditing && isLoadingRecord)) {
    return <><AppHead title={title} /><Layout><main className={shared.container}><section className={shared.card}><p>Carregando dados...</p></section></main></Layout></>;
  }
  if (error) return <><AppHead title={title} /><Layout><main className={shared.container}><section className={shared.card}><StatusMessage type="critical" name={error.name} action={error.action}>{error.message}</StatusMessage></section></main></Layout></>;
  if (!user || !hasAdminSectionAccess(user, "real-estate-properties") || !user.features.includes(requiredFeature)) return null;

  const isReadOnly = isEditing && !canUpdate;
  return (
    <>
      <AppHead title={title} description="Gerencie os dados cadastrais dos imóveis." />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section className={shared.card + " " + shared.cardUltraWide + " " + styles.card}>
            <AdminBackButton href="/admin/real-estate-properties" label="Voltar aos imóveis" />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true"><i className="fas fa-home"></i></div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>{title}</h1>
              <p>{isReadOnly ? "Consulta dos dados cadastrais deste imóvel." : "Preencha os dados do imóvel. Os campos estão organizados por identificação, localização, características e responsáveis."}</p>
            </header>
            {feedback && <div className={styles.feedback}><StatusMessage type="inline-error" name={feedback.name} action={feedback.action}>{feedback.message}</StatusMessage></div>}
            {isEditing && !record ? <p className={styles.empty}>Não foi possível carregar o imóvel informado.</p> : (
              <form className={styles.form} onSubmit={handleSubmit}>
                {SECTIONS.map((section) => (
                  <section className={styles.formSection} key={section.title}>
                    <div className={styles.sectionHeading}><h2>{section.title}</h2><p>{section.description}</p></div>
                    <div className={styles.grid}>
                      {section.fields.map((field) => (
                        <label className={styles[field.width] + " " + styles.field} key={field.name}>
                          <span className={shared.label}>{field.label}{field.required ? " *" : ""}</span>
                          <input className={shared.input} type="text"
                            inputMode={field.type === "decimal" ? "decimal" : ["integer", "ctm", "registration"].includes(field.type) ? "numeric" : "text"}
                            maxLength={field.maxLength} value={form[field.name]}
                            onChange={(event) => updateField(field.name, event.target.value, field.type)}
                            disabled={isSaving || isReadOnly} required={field.required}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
                <div className={styles.options}>
                  <label className={styles.switchField}>
                    <span><strong>Lançamento anual</strong><small>Indica se o cadastro corresponde ao lançamento anual.</small></span>
                    <span className={styles.switchControl}>
                      <input type="checkbox" role="switch" checked={form.annual}
                        onChange={(event) => setForm((current) => ({ ...current, annual: event.target.checked }))}
                        disabled={isSaving || isReadOnly} />
                      <span aria-hidden="true"></span>
                    </span>
                  </label>
                </div>
                <div className={styles.actions}>
                  <Button type="button" variant="outline" onClick={() => router.push("/admin/real-estate-properties")} disabled={isSaving}>Voltar</Button>
                  {!isReadOnly && <Button type="submit" icon="fa-save" disabled={isSaving}>{isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar imóvel"}</Button>}
                </div>
              </form>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}
export default RealEstatePropertyEditor;
