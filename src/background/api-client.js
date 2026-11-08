(function initApiClient(globalScope) {
  "use strict";

  const namespace = globalScope.TranslatorExt || {};
  const { EXTERNAL_URLS, DEFAULTS, SESSION_STATUS, HTTP_STATUS, UI_MESSAGES } = namespace.CONSTANTS;
  const { normalizeLanguageCode } = namespace.Languages;

  function decodeHtmlEntities(text) {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function isAuthenticationOrQuotaHttpStatus(httpStatus) {
    return (
      httpStatus === HTTP_STATUS.BAD_REQUEST ||
      httpStatus === HTTP_STATUS.UNAUTHORIZED ||
      httpStatus === HTTP_STATUS.FORBIDDEN
    );
  }

  async function requestGoogleTranslation({ apiKey, text, sourceLanguage, targetLanguage }) {
    const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmedKey) {
      return {
        ok: false,
        status: SESSION_STATUS.MISSING_API_KEY,
        errorMessage: UI_MESSAGES.MISSING_API_KEY
      };
    }

    const requestBody = {
      q: text,
      target: normalizeLanguageCode(targetLanguage),
      format: "text"
    };

    if (sourceLanguage && sourceLanguage !== DEFAULTS.AUTO_LANGUAGE) {
      requestBody.source = normalizeLanguageCode(sourceLanguage);
    }

    const endpointUrl = `${EXTERNAL_URLS.GOOGLE_TRANSLATE_V2_ENDPOINT}?key=${encodeURIComponent(trimmedKey)}`;

    let response;
    try {
      response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(requestBody)
      });
    } catch (_networkError) {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    if (!response.ok) {
      if (isAuthenticationOrQuotaHttpStatus(response.status)) {
        return {
          ok: false,
          status: SESSION_STATUS.INVALID_API_KEY,
          errorMessage: UI_MESSAGES.INVALID_API_KEY
        };
      }

      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch (_parseError) {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    const firstTranslation = responseJson?.data?.translations?.[0];
    if (!firstTranslation || typeof firstTranslation.translatedText !== "string") {
      return {
        ok: false,
        status: SESSION_STATUS.NETWORK_ERROR,
        errorMessage: UI_MESSAGES.NETWORK_ERROR
      };
    }

    const detectedSource = firstTranslation.detectedSourceLanguage
      ? normalizeLanguageCode(firstTranslation.detectedSourceLanguage)
      : normalizeLanguageCode(sourceLanguage);

    return {
      ok: true,
      status: SESSION_STATUS.SUCCESS,
      data: {
        translatedText: decodeHtmlEntities(firstTranslation.translatedText),
        detectedSourceLanguage: detectedSource
      }
    };
  }

  namespace.ApiClient = Object.freeze({
    requestGoogleTranslation
  });

  globalScope.TranslatorExt = namespace;
})(typeof globalThis !== "undefined" ? globalThis : window);
