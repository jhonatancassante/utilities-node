import { useState } from "react";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const FIELDS = [
  { name: "year", label: "Ano", type: "number", required: true },
  { name: "physical_property_id", label: "Código do imóvel", type: "number", required: true },
  { name: "physical_registration", label: "Inscrição física", required: true },
  { name: "ctm", label: "Cadastro municipal (CTM)", required: true },
  { name: "ctm_count", label: "Contador CTM", type: "number", required: true },
  { name: "grouping", label: "Agrupamento", required: true, maxLength: 1 },
  { name: "property_block", label: "Quadra", nullable: true },
  { name: "property_lots", label: "Lote", nullable: true },
  { name: "land_area", label: "Área do terreno (m²)", type: "number", required: true, step: "0.01" },
  { name: "built_area", label: "Área construída (m²)", type: "number", step: "0.01" },
  { name: "property_neighborhood", label: "Bairro", required: true, maxLength: 50 },
  { name: "owner_name", label: "Proprietário", required: true, maxLength: 100 },
  { name: "promissory_buyer", label: "Compromissário comprador", nullable: true, maxLength: 100 },
  { name: "land_sector", label: "Setor do terreno", type: "number", required: true },
  { name: "property_street", label: "Logradouro", required: true, maxLength: 100 },
  { name: "property_number", label: "Número", type: "number", nullable: true, step: "any" },
  { name: "property_complement", label: "Complemento", nullable: true, maxLength: 100 },
  { name: "construction_type", label: "Tipo de construção", type: "number", nullable: true },
  { name: "ideal_fraction", label: "Fração ideal", type: "number", nullable: true, step: "0.01" },
  { name: "points", label: "Pontuação", type: "number", nullable: true },
];

function createInitialForm(record) {
  return {
    year: String(record?.year ?? new Date().getFullYear()),
    physical_property_id: String(record?.physical_property_id ?? ""),
    physical_registration: record?.physical_registration ?? "",
    ctm: record?.ctm ?? "",
    ctm_count: String(record?.ctm_count ?? ""),
    grouping: record?.grouping ?? "",
    property_block: record?.property_block ?? "",
    property_lots: record?.property_lots ?? "",
    land_area: String(record?.land_area ?? ""),
    built_area: String(record?.built_area ?? "0"),
    property_neighborhood: record?.property_neighborhood ?? "",
    owner_name: record?.owner_name ?? "",
    promissory_buyer: record?.promissory_buyer ?? "",
    land_sector: String(record?.land_sector ?? ""),
    property_street: record?.property_street ?? "",
    property_number: String(record?.property_number ?? ""),
    property_complement: record?.property_complement ?? "",
    construction_type: String(record?.construction_type ?? ""),
    ideal_fraction: String(record?.ideal_fraction ?? ""),
    points: String(record?.points ?? ""),
    annual: record?.annual ?? false,
  };
}

function RealEstatePropertyModal({ record, onClose, onSubmit, isSaving, isReadOnly = false }) {
  const [form, setForm] = useState(() => createInitialForm(record));
  const [validationError, setValidationError] = useState("");


  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setValidationError("");
    const payload = {};
    for (const field of FIELDS) {
      const value = form[field.name].trim();
      if (!value && field.nullable) {
        payload[field.name] = null;
        continue;
      }
      if (!value && !field.required) continue;
      if (!value && field.required) {
        setValidationError("Preencha o campo " + field.label + ".");
        return;
      }
      if (field.type === "number") {
        const number = Number(value);
        if (!Number.isFinite(number) || (field.step !== "any" && field.step !== undefined && Math.round(number * 100) / 100 !== number)) {
          setValidationError("Informe um número válido no campo " + field.label + ".");
          return;
        }
        payload[field.name] = number;
      } else {
        payload[field.name] = value;
      }
    }
    payload.annual = Boolean(form.annual);
    onSubmit(payload);
  }

  const title = isReadOnly ? "Consultar imóvel" : record ? "Editar imóvel" : "Cadastrar imóvel";

  return (
    <Modal title={title} onClose={onClose} wide>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          {FIELDS.map((field) => (
            <label className={styles.field} key={field.name}>
              <span className={shared.label}>{field.label}{field.required ? " *" : ""}</span>
              <input
                className={shared.input}
                type={field.type || "text"}
                inputMode={field.type === "number" ? "decimal" : undefined}
                min={field.type === "number" ? "0" : undefined}
                step={field.step}
                maxLength={field.maxLength}
                value={form[field.name]}
                onChange={(event) => updateField(field.name, event.target.value)}
                disabled={isSaving || isReadOnly}
                required={field.required}
              />
            </label>
          ))}
        </div>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.annual} onChange={(event) => updateField("annual", event.target.checked)} disabled={isSaving || isReadOnly} />
          <span>Imóvel com lançamento anual</span>
        </label>
        {validationError && <p className={styles.validationError} role="alert">{validationError}</p>}
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Fechar</Button>
          {!isReadOnly && <Button type="submit" icon="fa-save" disabled={isSaving}>{isSaving ? "Salvando..." : record ? "Salvar alterações" : "Cadastrar imóvel"}</Button>}
        </div>
      </form>
    </Modal>
  );
}

export default RealEstatePropertyModal;
