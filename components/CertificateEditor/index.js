import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminBackButton from "@/components/AdminBackButton";
import AppHead from "@/components/AppHead";
import Button from "@/components/Button";
import Layout from "@/components/Layout";
import StatusMessage from "@/components/StatusMessage";
import useUser from "@/hooks/use-user.js";
import requestAPI from "@/lib/client/api.js";
import {
  hasAdminAccess,
  hasAdminSectionAccess,
} from "@/models/authorization.js";
import shared from "@/styles/shared.module.css";
import styles from "./index.module.css";

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function CertificateEditor({ recordId }) {
  const router = useRouter();
  const { user, error, isLoading } = useUser();
  const isEditing = Boolean(recordId);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    applicant_name: "",
    purpose: "Valor venal",
    physical_property_id: "",
    year: String(new Date().getFullYear()),
    is_updated: true,
    owner_rg: "",
    observations: "",
    validity_days: "30",
  });
  const [calculation, setCalculation] = useState(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEditing);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canCreate = user?.features?.includes("create:certificate");
  const canUpdateOwn = user?.features?.includes("update:certificate");
  const canUpdateOthers = user?.features?.includes("update:certificate:others");
  const canEdit =
    canUpdateOthers || (canUpdateOwn && record?.user_id === user?.id);

  useEffect(() => {
    if (
      !isLoading &&
      !user &&
      (!error || [401, 403].includes(error.statusCode))
    ) {
      router.replace("/login");
    }
    if (!isLoading && user && !hasAdminSectionAccess(user, "certificates")) {
      router.replace(hasAdminAccess(user) ? "/admin" : "/perfil");
    }
    if (!isLoading && user && !isEditing && !canCreate) {
      router.replace("/admin/certificates");
    }
  }, [canCreate, error, isEditing, isLoading, router, user]);

  useEffect(() => {
    if (!recordId || !user) return undefined;
    let active = true;
    requestAPI("/api/v1/certificates/" + encodeURIComponent(recordId))
      .then((data) => {
        if (!active) return;
        setRecord(data);
        setForm({
          applicant_name: data.applicant_name ?? "",
          purpose: data.purpose ?? "",
          physical_property_id: String(data.physical_property_id ?? ""),
          year: String(data.year ?? ""),
          is_updated: data.is_updated ?? true,
          owner_rg: data.owner_rg ?? "",
          observations: data.observations ?? "",
          validity_days: String(data.validity_days ?? 30),
        });
        setCalculation(data);
      })
      .catch((requestError) => {
        if (active) {
          setFeedback({
            type: "error",
            name: requestError.name,
            message: requestError.message,
            action: requestError.action,
          });
        }
      })
      .finally(() => {
        if (active) setIsLoadingRecord(false);
      });
    return () => {
      active = false;
    };
  }, [recordId, user]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    if (["physical_property_id", "year", "is_updated"].includes(name)) {
      setCalculation(null);
    }
  }

  async function handleCalculate(event) {
    event.preventDefault();
    setFeedback(null);
    setIsCalculating(true);
    setCalculation(null);
    try {
      const result = await requestAPI("/api/v1/certificates/calculate", {
        method: "POST",
        body: JSON.stringify({
          physical_property_id: Number(form.physical_property_id),
          year: Number(form.year),
          owner_rg: form.owner_rg.trim() || null,
          is_updated: form.is_updated,
        }),
      });
      setCalculation(result);
      setFeedback({
        type: "success",
        message: "Cálculo concluído. Confira os dados antes de gravar.",
      });
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsCalculating(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!calculation) {
      setFeedback({
        type: "error",
        message: "Faça o cálculo e confira os valores antes de gravar.",
      });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload = {
        applicant_name: form.applicant_name.trim(),
        purpose: form.purpose.trim(),
        physical_property_id: Number(form.physical_property_id),
        year: Number(form.year),
        is_updated: form.is_updated,
        owner_rg: form.owner_rg.trim() || null,
        observations: form.observations.trim() || null,
        validity_days: Number(form.validity_days),
      };
      const saved = await requestAPI(
        isEditing
          ? "/api/v1/certificates/" + encodeURIComponent(recordId)
          : "/api/v1/certificates",
        {
          method: isEditing ? "PATCH" : "POST",
          body: JSON.stringify(
            isEditing
              ? {
                  applicant_name: payload.applicant_name,
                  purpose: payload.purpose,
                  observations: payload.observations,
                  validity_days: payload.validity_days,
                }
              : payload,
          ),
        },
      );
      router.push("/admin/certificates/" + encodeURIComponent(saved.id));
      if (!isEditing) {
        setFeedback({
          type: "success",
          message: "Certidão gravada com sucesso.",
        });
      }
    } catch (requestError) {
      setFeedback({
        type: "error",
        name: requestError.name,
        message: requestError.message,
        action: requestError.action,
      });
    } finally {
      setIsSaving(false);
    }
  }

  const isReadOnly = isEditing && !canEdit;
  const title = isEditing
    ? isReadOnly
      ? "Consultar certidão"
      : "Editar certidão"
    : "Emitir nova certidão";

  if (isLoading || (!user && !error) || (isEditing && isLoadingRecord)) {
    return (
      <>
        <AppHead title={title} />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <p>Carregando dados...</p>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppHead title={title} />
        <Layout>
          <main className={shared.container}>
            <section className={shared.card}>
              <StatusMessage
                type="critical"
                name={error.name}
                action={error.action}
              >
                {error.message}
              </StatusMessage>
            </section>
          </main>
        </Layout>
      </>
    );
  }

  if (
    !user ||
    !hasAdminSectionAccess(user, "certificates") ||
    (!isEditing && !canCreate)
  ) {
    return null;
  }

  return (
    <>
      <AppHead
        title={title}
        description="Emita e mantenha certidões de valor venal."
      />
      <Layout>
        <main className={shared.container + " " + shared.containerUltraWide}>
          <section
            className={
              shared.card + " " + shared.cardUltraWide + " " + styles.card
            }
          >
            <AdminBackButton
              href="/admin/certificates"
              label="Voltar às certidões"
            />
            <header className={styles.header}>
              <div className={shared.icon} aria-hidden="true">
                <i className="fas fa-file-alt"></i>
              </div>
              <span className={shared.badge}>ADMINISTRAÇÃO</span>
              <h1>{title}</h1>
              <p>
                {isReadOnly
                  ? "Consulta dos dados da certidão."
                  : "Informe os dados do requerente e do imóvel. O cálculo é realizado no servidor e deve ser conferido antes da gravação."}
              </p>
            </header>
            {feedback && (
              <div className={styles.feedback}>
                <StatusMessage
                  type={
                    feedback.type === "success" ? "success" : "inline-error"
                  }
                  name={feedback.name}
                  action={feedback.action}
                >
                  {feedback.message}
                </StatusMessage>
              </div>
            )}
            {isEditing && !record ? (
              <p className={styles.empty}>
                Não foi possível carregar a certidão.
              </p>
            ) : (
              <form className={styles.form} onSubmit={handleSave}>
                <section className={styles.formSection}>
                  <div className={styles.sectionHeading}>
                    <h2>Identificação da certidão</h2>
                    <p>Dados do requerimento e do exercício solicitado.</p>
                  </div>
                  <div className={styles.grid}>
                    <label className={styles.half}>
                      <span className={shared.label}>Nome do requerente *</span>
                      <input
                        className={shared.input}
                        value={form.applicant_name}
                        onChange={(event) =>
                          updateField("applicant_name", event.target.value)
                        }
                        maxLength={150}
                        required
                        disabled={isReadOnly || isSaving}
                      />
                    </label>
                    <label className={styles.half}>
                      <span className={shared.label}>Finalidade *</span>
                      <input
                        className={shared.input}
                        value={form.purpose}
                        onChange={(event) =>
                          updateField("purpose", event.target.value)
                        }
                        maxLength={50}
                        required
                        disabled={isReadOnly || isSaving}
                      />
                    </label>
                    <label className={styles.third}>
                      <span className={shared.label}>
                        Código físico do imóvel *
                      </span>
                      <input
                        className={shared.input}
                        type="number"
                        min="1"
                        step="1"
                        value={form.physical_property_id}
                        onChange={(event) =>
                          updateField(
                            "physical_property_id",
                            event.target.value,
                          )
                        }
                        required
                        disabled={isReadOnly || isSaving || isEditing}
                      />
                    </label>
                    <label className={styles.third}>
                      <span className={shared.label}>Exercício *</span>
                      <input
                        className={shared.input}
                        type="number"
                        min="1"
                        max="9999"
                        step="1"
                        value={form.year}
                        onChange={(event) =>
                          updateField("year", event.target.value)
                        }
                        required
                        disabled={isReadOnly || isSaving || isEditing}
                      />
                    </label>
                    <label className={styles.third}>
                      <span className={shared.label}>RG do proprietário</span>
                      <input
                        className={shared.input}
                        value={form.owner_rg}
                        onChange={(event) =>
                          updateField("owner_rg", event.target.value)
                        }
                        maxLength={20}
                        disabled={isReadOnly || isSaving || isEditing}
                      />
                    </label>
                  </div>
                </section>
                {!isEditing && (
                  <section className={styles.options}>
                    <label className={styles.switchField}>
                      <span>
                        <strong>Cadastro atualizado</strong>
                        <small>
                          Desativado utiliza os dados do lançamento anual.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={form.is_updated}
                        onChange={(event) =>
                          updateField("is_updated", event.target.checked)
                        }
                        disabled={isSaving}
                      />
                    </label>
                    <Button
                      type="button"
                      onClick={handleCalculate}
                      disabled={isCalculating || isSaving}
                    >
                      {isCalculating ? "Calculando..." : "Calcular valores"}
                    </Button>
                  </section>
                )}
                {calculation && (
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeading}>
                      <h2>Dados do imóvel e resultado do cálculo</h2>
                      <p>
                        Valores retornados pela API. Confira antes de emitir.
                      </p>
                    </div>
                    <div className={styles.summaryGrid}>
                      {[
                        ["Inscrição física", calculation.physical_registration],
                        ["Proprietário", calculation.owner_name],
                        ["Compromissário", calculation.promissory_buyer],
                        [
                          "Endereço",
                          [
                            calculation.property_street,
                            calculation.property_number,
                            calculation.property_neighborhood,
                          ]
                            .filter(Boolean)
                            .join(", "),
                        ],
                        ["Quadra", calculation.property_block],
                        ["Lote", calculation.property_lots],
                        ["Área do terreno", calculation.land_area + " m²"],
                        ["Área construída", calculation.built_area + " m²"],
                      ].map(([label, value]) => (
                        <div className={styles.summaryItem} key={label}>
                          <span>{label}</span>
                          <strong>{value || "—"}</strong>
                        </div>
                      ))}
                    </div>
                    <div className={styles.valueGrid}>
                      <div>
                        <span>Valor venal do terreno</span>
                        <strong>
                          {formatCurrency(calculation.land_value)}
                        </strong>
                      </div>
                      <div>
                        <span>Valor venal da edificação</span>
                        <strong>
                          {formatCurrency(calculation.building_value)}
                        </strong>
                      </div>
                      <div>
                        <span>Valor venal total</span>
                        <strong>
                          {formatCurrency(calculation.total_value)}
                        </strong>
                      </div>
                    </div>
                  </section>
                )}
                <section className={styles.formSection}>
                  <div className={styles.sectionHeading}>
                    <h2>Informações complementares</h2>
                    <p>
                      Validade e observações que serão gravadas na certidão.
                    </p>
                  </div>
                  <div className={styles.grid}>
                    <label className={styles.third}>
                      <span className={shared.label}>Validade (dias)</span>
                      <input
                        className={shared.input}
                        type="number"
                        min="1"
                        step="1"
                        value={form.validity_days}
                        onChange={(event) =>
                          updateField("validity_days", event.target.value)
                        }
                        disabled={isReadOnly || isSaving}
                      />
                    </label>
                    <label className={styles.full}>
                      <span className={shared.label}>Observações</span>
                      <textarea
                        className={shared.input}
                        rows={3}
                        maxLength={150}
                        value={form.observations}
                        onChange={(event) =>
                          updateField("observations", event.target.value)
                        }
                        disabled={isReadOnly || isSaving}
                      />
                    </label>
                  </div>
                </section>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/admin/certificates")}
                    disabled={isSaving}
                  >
                    Voltar
                  </Button>
                  {!isReadOnly && (
                    <Button
                      type="submit"
                      icon="fa-save"
                      disabled={isSaving || (isEditing ? false : !calculation)}
                    >
                      {isSaving
                        ? "Gravando..."
                        : isEditing
                          ? "Salvar alterações"
                          : "Gravar certidão"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </section>
        </main>
      </Layout>
    </>
  );
}

export default CertificateEditor;
