const receiptKey = tabId => 'download-receipt:' + tabId;

export async function readDownloadReceipt(tabId, origin) {
  const key = receiptKey(tabId);
  return navigator.locks.request(key, async () => {
    const receipt = (await chrome.storage.session.get(key))[key];
    return receipt?.origin === origin && !receipt.dismissed ? receipt : null;
  });
}

export async function publishDownloadReceipt(tabId, origin, input) {
  if (!/^[a-f\d-]{36}$/i.test(input?.id || '') ||
      !['complete', 'failed', 'stopped'].includes(input.status) ||
      typeof input.message !== 'string' || !input.message.trim()) {
    throw Error('下载结果无效');
  }
  const receipt = {
    id: input.id,
    status: input.status,
    origin,
    message: input.message.slice(0, 700),
    updated: Number.isFinite(input.updated) ? Math.min(input.updated, Date.now()) : Date.now(),
  };
  const key = receiptKey(tabId);
  await navigator.locks.request(key, async () => {
    const previous = (await chrome.storage.session.get(key))[key];
    if (previous?.id === receipt.id || previous?.updated > receipt.updated) return;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab) await chrome.storage.session.set({ [key]: receipt });
    if (tab?.url && new URL(tab.url).origin === origin) {
      chrome.tabs.sendMessage(tabId, { type: 'page-tools-download-receipt', receipt }, { frameId: 0 }).catch(() => {});
    }
    const ok = receipt.status === 'complete';
    await chrome.storage.local.set({ lastResult: { ok, message: receipt.message, time: receipt.updated } });
    await chrome.action.setBadgeBackgroundColor({ color: ok ? '#5865ce' : '#af453e' });
    await chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
  });
}

export async function dismissDownloadReceipt(tabId, id) {
  const key = receiptKey(tabId);
  await navigator.locks.request(key, async () => {
    const receipt = (await chrome.storage.session.get(key))[key];
    if (receipt?.id === id) await chrome.storage.session.set({ [key]: { ...receipt, dismissed: true } });
  });
}

export function forgetDownloadReceipt(tabId) {
  const key = receiptKey(tabId);
  return navigator.locks.request(key, () => chrome.storage.session.remove(key));
}
