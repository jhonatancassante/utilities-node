import { useState } from "react";
import Button from "@/components/Button";
import FieldError from "@/components/FieldError";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

const SECTOR_FIELDS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  "9a",
  10,
  11,
  "11a",
  "11b",
  12,
  13,
  14,
  15,
  16,
  17,
].map((number) => ({
  name: "sector_" + number,
  label: "Setor " + number,
}));
const PROPERTY_TYPES = [
  "precarious",
  "simple",
  "regular",
  "medium",
  "good",
  "sophisticated",
];
const PROPERTY_LABELS = {
  precarious: "Precário",
  simple: "Simples",
  regular: "Regular",
  medium: "Médio",
  good: "Bom",
  sophisticated: "Sofisticado",
};
const GROUPS = [
  { title: "Setores", fields: SECTOR_FIELDS },
  ...["residential", "commercial", "industrial"].map((type) => ({
    title:
      type === "residential"
        ? "Padrões residenciais"
        : type === "commercial"
          ? "Padrões comerciais"
          : "Padrões industriais",
    fields: PROPERTY_TYPES.map((level) => ({
      name: type + "_" + level,
      label: PROPERTY_LABELS[level],
    })),
  })),
  {
    title: "Outros valores",
    fields: [
      { name: "cleaning", label: "Limpeza" },
      { name: "garbage", label: "Coleta de lixo" },
      { name: "rural", label: "Área rural" },
    ],
  },
];
const ALL_NUMERIC_FIELDS = GROUPS.flatMap((group) => group.fields);
const EMPTY_FORM = {
  year: new Date().getFullYear(),
  decree: "",
  ...Object.fromEntries(ALL_NUMERIC_FIELDS.map((field) => [field.name, ""])),
};

function AssessedValueForm({
  initialValue,
  onSubmit,
  onCancel,
  isSaving,
  isReadOnly,
  submitLabel,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.entries(initialValue || {}).map(([key, value]) => [
        key,
        value === null || value === undefined
          ? ""
          : ALL_NUMERIC_FIELDS.some((field) => field.name === key)
            ? String(value).replace(".", ",")
            : String(value),
      ]),
    ),
  }));
  const [fieldErrors, setFieldErrors] = useState({});

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = {};
    const payload = {};
    const year = Number(form.year);

    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      errors.year = "Informe um ano válido entre 1 e 9999.";
    }
    payload.year = year;
    payload.decree = form.decree.trim() || null;

    for (const field of ALL_NUMERIC_FIELDS) {
      const rawValue = form[field.name].trim();
      if (!rawValue) {
        payload[field.name] = null;
        continue;
      }
      const normalized = rawValue.replace(/\./g, "").replace(",", ".");
      const value = Number(normalized);
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 9999999999.99 ||
        Math.round(value * 100) / 100 !== value
      ) {
        errors[field.name] =
          "Use números não negativos com até duas casas decimais.";
        continue;
      }
      payload[field.name] = value;
    }

    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      event.currentTarget.elements[
        firstInvalid === "year" ? "assessed-year" : "assessed-" + firstInvalid
      ]?.focus();
      return;
    }

    onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.basicFields}>
        <div className={styles.field}>
          <label className={shared.label} htmlFor="assessed-year">
            Ano de referência *
          </label>
          <input
            className={`${shared.input} ${fieldErrors.year ? shared.inputInvalid : ""}`}
            id="assessed-year"
            type="number"
            min="1"
            max="9999"
            step="1"
            value={form.year}
            onChange={(event) => updateField("year", event.target.value)}
            required
            disabled={isSaving || isReadOnly}
            aria-invalid={Boolean(fieldErrors.year)}
            aria-describedby={
              fieldErrors.year ? "assessed-year-error" : undefined
            }
          />
          <FieldError id="assessed-year-error">{fieldErrors.year}</FieldError>
        </div>
        <div className={styles.field}>
          <label className={shared.label} htmlFor="assessed-decree">
            Decreto
          </label>
          <input
            className={shared.input}
            id="assessed-decree"
            type="text"
            maxLength="12"
            value={form.decree}
            onChange={(event) => updateField("decree", event.target.value)}
            disabled={isSaving || isReadOnly}
            placeholder="Número do decreto"
          />
        </div>
      </div>
      {GROUPS.map((group) => (
        <fieldset className={styles.group} key={group.title}>
          <legend>{group.title}</legend>
          <div className={styles.fieldsGrid}>
            {group.fields.map((field) => (
              <div className={styles.field} key={field.name}>
                <label
                  className={shared.label}
                  htmlFor={"assessed-" + field.name}
                >
                  {field.label}
                </label>
                <input
                  className={`${shared.input} ${fieldErrors[field.name] ? shared.inputInvalid : ""}`}
                  id={"assessed-" + field.name}
                  type="text"
                  inputMode="decimal"
                  value={form[field.name]}
                  onChange={(event) =>
                    updateField(field.name, event.target.value)
                  }
                  disabled={isSaving || isReadOnly}
                  placeholder="—"
                  aria-invalid={Boolean(fieldErrors[field.name])}
                  aria-describedby={
                    fieldErrors[field.name]
                      ? "assessed-" + field.name + "-error"
                      : undefined
                  }
                />
                <FieldError id={"assessed-" + field.name + "-error"}>
                  {fieldErrors[field.name]}
                </FieldError>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div className={styles.actions}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        {!isReadOnly && (
          <Button type="submit" icon="fa-save" disabled={isSaving}>
            {isSaving ? "Salvando..." : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
export default AssessedValueForm;
