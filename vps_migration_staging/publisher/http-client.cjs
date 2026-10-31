'use strict';

class HttpRequestError extends Error {
  constructor(message, { name = 'HttpRequestError', code = null, method = 'GET', uncertain = false, status = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = name;
    this.code = code;
    this.method = method;
    this.uncertain = Boolean(uncertain);
    this.status = status;
  }
}

/**
 * Fetch helper that keeps the timeout active until the entire response body is read.
 * Successful POST responses with unreadable/invalid bodies are marked uncertain because
 * the remote platform may already have accepted the side effect.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const method = String(options.method || 'GET').toUpperCase();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (timedOut || err?.name === 'AbortError') {
        throw new HttpRequestError(`İstek zaman aşımına uğradı (${timeoutMs} ms)`, {
          name: 'TimeoutError', code: 'ETIMEDOUT', method,
          uncertain: method === 'POST', cause: err
        });
      }
      const code = err?.cause?.code || err?.code || null;
      throw new HttpRequestError(err?.message || 'Ağ isteği başarısız oldu', {
        name: 'NetworkRequestError', code, method,
        uncertain: method === 'POST', cause: err
      });
    }

    let rawText;
    try {
      rawText = await response.text();
    } catch (err) {
      if (timedOut || err?.name === 'AbortError') {
        throw new HttpRequestError(`Yanıt gövdesi zaman aşımına uğradı (${timeoutMs} ms)`, {
          name: 'TimeoutError', code: 'ETIMEDOUT', method,
          uncertain: method === 'POST' && response.ok, status: response.status, cause: err
        });
      }
      throw new HttpRequestError(`Yanıt gövdesi okunamadı: ${err?.message || 'bilinmeyen hata'}`, {
        name: 'ResponseBodyError', method,
        uncertain: method === 'POST' && response.ok, status: response.status, cause: err
      });
    }

    let data = {};
    if (rawText && rawText.trim()) {
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        if (response.ok && method === 'POST') {
          throw new HttpRequestError('Platform POST yanıtı geçerli JSON içermiyor; işlem sonucu belirsiz.', {
            name: 'ResponseParseError', code: 'INVALID_JSON', method,
            uncertain: true, status: response.status, cause: err
          });
        }
        data = { _rawText: rawText, _parseError: err.message };
      }
    } else if (response.ok && method === 'POST') {
      throw new HttpRequestError('Platform POST yanıtı boş; işlem sonucu belirsiz.', {
        name: 'ResponseBodyError', code: 'EMPTY_BODY', method,
        uncertain: true, status: response.status
      });
    }

    // 5xx yanıtlarında sunucu isteği işlemiş ancak yanıt üretirken hata yaşamış olabilir.
    // POST için mükerrer yayın riskine karşı mutabakat gerekir; GET güvenle tekrar denenebilir.
    if (response.status >= 500) {
      throw new HttpRequestError(`Uzak sunucu HTTP ${response.status} hatası döndürdü.`, {
        name: 'HttpServerError', code: `HTTP_${response.status}`, method,
        uncertain: method === 'POST', status: response.status
      });
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      json: async () => data,
      text: async () => rawText,
      headers: response.headers
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

module.exports = { fetchWithTimeout, HttpRequestError };
