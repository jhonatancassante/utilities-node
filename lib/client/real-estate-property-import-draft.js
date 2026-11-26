const DATABASE_NAME = "utilities-node-imports";
const STORE_NAME = "drafts";
const DRAFT_ID = "real-estate-properties";

function openDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(
      new Error("O navegador não oferece suporte ao armazenamento local."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runDraftRequest(mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export function saveRealEstatePropertyImportDraft(records) {
  return runDraftRequest("readwrite", (store) =>
    store.put({ id: DRAFT_ID, records, updatedAt: Date.now() }),
  );
}

export async function getRealEstatePropertyImportDraft() {
  const draft = await runDraftRequest("readonly", (store) =>
    store.get(DRAFT_ID),
  );
  return draft?.records ?? null;
}

export function deleteRealEstatePropertyImportDraft() {
  return runDraftRequest("readwrite", (store) => store.delete(DRAFT_ID));
}
