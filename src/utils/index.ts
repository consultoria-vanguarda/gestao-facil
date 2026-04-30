export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

/** Link para HourlyRates aberto na aba «Análise de Viabilidade». */
export function createHourlyRatesViabilityUrl(): string {
    const base = createPageUrl('HourlyRates');
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}tab=viability`;
}