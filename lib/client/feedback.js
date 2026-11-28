// Converte um erro de requisição no objeto de feedback do StatusMessage.
// Erros devolvidos pela API (com statusCode) são exibidos em modal, com o nome
// do erro; falhas sem resposta (rede, navegador) viram aviso simples (toast).
export function feedbackFromError(error) {
  return {
    type: "error",
    name: error.statusCode ? error.name : undefined,
    message: error.message,
    action: error.action,
  };
}
