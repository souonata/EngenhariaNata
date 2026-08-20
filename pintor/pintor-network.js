const TRANSPORT_FAILURE = /failed to fetch|networkerror|network error|load failed/i;

export function localizedFetchError(error, fallback) {
    const message = error instanceof Error ? error.message.trim() : '';
    if (!message || error instanceof TypeError || TRANSPORT_FAILURE.test(message)) {
        return fallback;
    }
    return message;
}
