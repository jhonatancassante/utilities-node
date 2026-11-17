# Adicionando uma nova ferramenta

Toda ferramenta segue o mesmo padrão. O Gerador de QR Code é a referência.

## Estrutura

```text
configs/tools.js                      registro central (menu, home, título, descrição)
pages/ferramentas/<slug>.js           rota fina: só monta <ToolPage> + o componente
features/<slug>/components/...        componentes da ferramenta (cada um com seu CSS Module)
features/<slug>/lib/...               lógica pura, sem React (fácil de testar)
tests/unit/features/<slug>/...        testes da lógica
```

## Passo a passo

1. Em `configs/tools.js`, troque o `status` da ferramenta de `soon` para
   `available` (ela já está registrada com título, descrição e ícone).
2. Crie `pages/ferramentas/<slug>.js`:

   ```js
   import ToolPage from "@/components/ToolPage";
   import MinhaFerramenta from "@/features/<slug>/components/MinhaFerramenta";

   export default function Page() {
     return (
       <ToolPage slug="<slug>">
         <MinhaFerramenta />
       </ToolPage>
     );
   }
   ```

3. Implemente a ferramenta em `features/<slug>/`, reutilizando `Button`
   (`@/components/Button`) e as classes `label`, `input`, `errorText` e
   `infoBox` de `@/styles/shared.module.css`.
4. Escreva os testes da lógica em `tests/unit/features/<slug>/`.

## Regras

- Bibliotecas pesadas e que dependem do navegador (como `html2canvas`) entram
  por `import()` dinâmico, dentro da função que as usa.
- Ferramentas que processam arquivos (PDF, CSV, JSON, TXT) rodam no navegador:
  o arquivo não precisa ser enviado ao servidor.
- A futura sessão de login entra no espaço reservado em
  `components/Header/index.js` (bloco `actions`).
