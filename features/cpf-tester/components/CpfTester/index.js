// features/cpf-tester/components/CpfTester/index.js
import { useState } from "react";
import Button from "@/components/Button";
import HelpToggle from "@/components/HelpToggle";
import shared from "@/styles/shared.module.css";
import {
  calculateVerifiers,
  formatCpf,
  generateCpfVariations,
  isValidCpf,
} from "../../lib/cpf.js";
import styles from "./index.module.css";

function CpfTester() {
  const [cpf, setCpf] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [inputError, setInputError] = useState("");

  const digits = cpf.replace(/\D/g, "");
  const hasCompleteCpf = digits.length === 11;
  const cpfIsValid = hasCompleteCpf && isValidCpf(digits);
  const inputStatus = !hasCompleteCpf ? "" : cpfIsValid ? "valid" : "invalid";

  function handleChange(event) {
    const value = event.target.value.replace(/\D/g, "").slice(0, 11);
    setCpf(formatCpf(value));
    setTestResult(null);
    setInputError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!hasCompleteCpf) {
      setInputError("Preencha os 11 dígitos do CPF para testar as variações.");
      setTestResult(null);
      return;
    }

    const base = digits.slice(0, 9);
    const correctVerifiers = calculateVerifiers(base);

    setInputError("");
    setTestResult({
      base,
      correctVerifiers,
      correctCpf: base + correctVerifiers,
      variations: generateCpfVariations(digits),
    });
  }

  function handleClear() {
    setCpf("");
    setTestResult(null);
    setInputError("");
  }

  return (
    <div className={styles.tester}>
      <HelpToggle>
        <strong>Como funciona:</strong> digite um CPF para verificar se os
        dígitos informados são válidos. A ferramenta também calcula os dígitos
        verificadores corretos para os nove primeiros números e testa
        substituições individuais em cada posição, listando as combinações
        válidas encontradas. Todo o processamento ocorre no navegador; nenhum
        dado é enviado ao servidor.
      </HelpToggle>

      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="cpf-tester-input" className={shared.label}>
          CPF
        </label>
        <div className={styles.inputContainer}>
          <input
            id="cpf-tester-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="000.000.000-00"
            value={cpf}
            onChange={handleChange}
            aria-invalid={Boolean(inputError) || inputStatus === "invalid"}
            aria-describedby="cpf-tester-status"
            className={
              shared.input +
              " " +
              styles.cpfInput +
              (inputStatus ? " " + styles[inputStatus] : "")
            }
          />
          <p
            id="cpf-tester-status"
            className={
              styles.status + (inputStatus ? " " + styles[inputStatus] : "")
            }
            aria-live="polite"
          >
            {inputStatus === "valid"
              ? "✓ CPF válido"
              : inputStatus === "invalid"
                ? "✕ CPF inválido"
                : ""}
          </p>
        </div>

        {inputError && (
          <p role="alert" className={shared.errorText}>
            {inputError}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="submit" icon="fa-search">
            Testar variações
          </Button>
          <Button
            type="button"
            variant="danger"
            icon="fa-trash-alt"
            onClick={handleClear}
          >
            Limpar
          </Button>
        </div>
      </form>

      {testResult && (
        <>
          <section className={styles.verifierBox} aria-live="polite">
            <h2>
              <i className="fas fa-check-circle" aria-hidden="true"></i>
              Dígitos verificadores corretos
            </h2>
            <p>
              Para a base <strong>{formatCpf(testResult.base)}</strong>, os
              dígitos corretos são{" "}
              <strong>{testResult.correctVerifiers}</strong>:
            </p>
            <p className={styles.correctCpf}>
              {formatCpf(testResult.correctCpf)}
            </p>
          </section>

          <section className={styles.results} aria-label="Variações válidas">
            <h2>
              Outras combinações válidas encontradas (
              {testResult.variations.length}):
            </h2>

            {testResult.variations.length === 0 ? (
              <p className={styles.empty}>
                Nenhuma variação válida encontrada.
              </p>
            ) : (
              <ul className={styles.resultsList}>
                {testResult.variations.map((item) => (
                  <li
                    key={item.cpf}
                    className={item.isOriginal ? styles.originalCpf : ""}
                  >
                    <span className={styles.resultCpf}>
                      {formatCpf(item.cpf)}
                    </span>
                    <span
                      className={
                        item.isOriginal ? styles.originalBadge : styles.badge
                      }
                    >
                      {item.isOriginal
                        ? "CPF original digitado"
                        : "Dígito alterado na posição " +
                          (item.changedIndex + 1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default CpfTester;
