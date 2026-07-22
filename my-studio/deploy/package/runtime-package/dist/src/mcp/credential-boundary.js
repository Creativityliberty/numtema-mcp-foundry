import { URL } from 'node:url';
export function injectCredential(plan, credentialPlan, binding, options) {
    const request = {
        ...plan.request,
        query: plan.request.query.map((entry) => ({ ...entry })),
        headers: plan.request.headers.map((entry) => ({ ...entry })),
        body: plan.request.body === null ? null : { ...plan.request.body }
    };
    const selected = credentialPlan.selected_credential;
    if (selected === null || binding === undefined || binding.injection.strategy === 'none')
        return request;
    const envName = options.credentialEnvironment[selected.credential_handle];
    if (envName === undefined)
        throw new Error(`CREDENTIAL_ENV_NOT_CONFIGURED: no environment variable is mapped for credential handle ${selected.credential_handle}.`);
    const secret = options.environment[envName];
    if (secret === undefined || secret.length === 0)
        throw new Error(`CREDENTIAL_MATERIAL_UNAVAILABLE: environment variable ${envName} is empty or missing.`);
    const value = binding.injection.prefix ? `${binding.injection.prefix} ${secret}` : secret;
    const name = binding.injection.name;
    if (binding.injection.location === 'header') {
        if (name === null)
            throw new Error('CREDENTIAL_BINDING_INVALID: header injection requires a name.');
        request.headers = [...request.headers.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase()), { name, value }];
        return request;
    }
    if (binding.injection.location === 'query') {
        if (name === null)
            throw new Error('CREDENTIAL_BINDING_INVALID: query injection requires a name.');
        request.query = [...request.query.filter((entry) => entry.name !== name), { name, value }];
        const url = new URL(request.url);
        url.search = '';
        for (const entry of request.query)
            url.searchParams.append(entry.name, entry.value);
        request.url = url.toString();
        return request;
    }
    if (binding.injection.location === 'cookie') {
        if (name === null)
            throw new Error('CREDENTIAL_BINDING_INVALID: cookie injection requires a name.');
        const existing = request.headers.find((entry) => entry.name.toLowerCase() === 'cookie');
        const cookie = `${name}=${encodeURIComponent(value)}`;
        request.headers = request.headers.filter((entry) => entry.name.toLowerCase() !== 'cookie');
        request.headers.push({ name: 'Cookie', value: existing ? `${existing.value}; ${cookie}` : cookie });
        return request;
    }
    if (binding.injection.location === 'runtime' || binding.injection.strategy === 'host_managed') {
        throw new Error('HOST_MANAGED_CREDENTIAL_UNRESOLVED: runtime injection requires a provider-specific credential adapter.');
    }
    return request;
}
//# sourceMappingURL=credential-boundary.js.map