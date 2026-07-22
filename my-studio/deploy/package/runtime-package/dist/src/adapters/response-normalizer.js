export function normalizeProviderResponse(adapter, response) {
    const successMatcher = findMatcher(adapter.response.success, response.status);
    const errorMatcher = findMatcher(adapter.response.errors, response.status)
        ?? findMatcher(adapter.response.other, response.status);
    const ok = successMatcher !== undefined || (response.status >= 200 && response.status < 300 && errorMatcher === undefined);
    const matcher = ok ? successMatcher : errorMatcher;
    const mediaType = headerValue(response.headers, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? null;
    const kind = resolveNormalizer(matcher, mediaType, response.status, response.body);
    const data = normalizeBody(kind, response.body);
    if (ok) {
        return { ok: true, status: response.status, media_type: mediaType, kind, data, error: null };
    }
    return {
        ok: false,
        status: response.status,
        media_type: mediaType,
        kind,
        data,
        error: {
            code: `provider_http_${response.status}`,
            category: categoryForStatus(response.status),
            message: errorMessage(data, response.status),
            retryable: isRetryable(response.status),
            provider_status: response.status
        }
    };
}
function findMatcher(matchers, status) {
    return matchers.find((matcher) => statusMatches(matcher.status, status));
}
function statusMatches(pattern, status) {
    if (pattern === 'default')
        return true;
    if (/^\d{3}$/.test(pattern))
        return Number(pattern) === status;
    if (/^[1-5]XX$/i.test(pattern))
        return Number(pattern[0]) === Math.floor(status / 100);
    return false;
}
function resolveNormalizer(matcher, mediaType, status, body) {
    if (status === 204 || body === null || body === undefined || body === '')
        return 'empty';
    if (matcher && matcher.normalizer !== 'adaptive')
        return matcher.normalizer;
    if (mediaType !== null && (mediaType === 'application/json' || mediaType.endsWith('+json')))
        return 'json';
    if (mediaType?.startsWith('text/'))
        return 'text';
    if (mediaType !== null && isBinaryContentType(mediaType))
        return 'binary';
    if (body instanceof Uint8Array)
        return 'binary';
    return matcher?.normalizer ?? 'adaptive';
}
function normalizeBody(kind, body) {
    if (kind === 'empty')
        return null;
    if (kind === 'json' && typeof body === 'string') {
        try {
            return JSON.parse(body);
        }
        catch {
            return body;
        }
    }
    if (kind === 'text' && body !== null && body !== undefined && typeof body !== 'string') {
        return String(body);
    }
    return body;
}
function errorMessage(data, status) {
    if (isRecord(data)) {
        for (const key of ['detail', 'message', 'title', 'error_description', 'error']) {
            const value = data[key];
            if (typeof value === 'string' && value.trim().length > 0)
                return value;
        }
    }
    if (typeof data === 'string' && data.trim().length > 0)
        return data;
    return `Provider returned HTTP ${status}.`;
}
function categoryForStatus(status) {
    if (status === 400 || status === 405 || status === 406 || status === 415 || status === 422)
        return 'invalid_request';
    if (status === 401)
        return 'authentication';
    if (status === 403)
        return 'authorization';
    if (status === 404 || status === 410)
        return 'not_found';
    if (status === 409 || status === 412)
        return 'conflict';
    if (status === 408 || status === 504)
        return 'timeout';
    if (status === 425 || status === 429)
        return 'rate_limited';
    if (status === 502 || status === 503)
        return 'provider_unavailable';
    return 'provider_error';
}
function isRetryable(status) {
    return [408, 425, 429, 500, 502, 503, 504].includes(status);
}
function headerValue(headers, name) {
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === target)
            return value;
    }
    return undefined;
}
function isBinaryContentType(value) {
    return value === 'application/octet-stream' || value === 'application/pdf' || value.startsWith('image/') || value.startsWith('audio/') || value.startsWith('video/');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}
//# sourceMappingURL=response-normalizer.js.map