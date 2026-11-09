export interface PromptTokenCounter {
    count(prompt: string): Promise<number> | number;
}

export interface PromptTokenRow {
    component: string;
    model: string;
    tokensSliced: number;
    tokensFull: number;
    eta: number | null;
}

export async function countPromptTokens(
    component: string,
    model: string,
    slicedPrompt: string,
    fullPrompt: string,
    counter: PromptTokenCounter,
): Promise<PromptTokenRow> {
    const [tokensSliced, tokensFull] = await Promise.all([
        counter.count(slicedPrompt),
        counter.count(fullPrompt),
    ]);

    return {
        component,
        model,
        tokensSliced,
        tokensFull,
        eta: calculateEta(tokensSliced, tokensFull),
    };
}

export function calculateEta(
    tokensSliced: number,
    tokensFull: number,
): number | null {
    return tokensFull === 0 ? null : 1 - tokensSliced / tokensFull;
}

export function serializePromptTokenCsv(rows: PromptTokenRow[]): string {
    const lines = [
        'component,model,tokens_sliced,tokens_full,eta',
        ...rows.map(({ component, model, tokensSliced, tokensFull, eta }) =>
            [
                component,
                model,
                String(tokensSliced),
                String(tokensFull),
                eta === null ? '' : String(eta),
            ]
                .map(escapeCsv)
                .join(','),
        ),
    ];
    return `${lines.join('\n')}\n`;
}

function escapeCsv(value: string): string {
    if (!/[",\r\n]/.test(value)) {
        return value;
    }
    return `"${value.replace(/"/g, '""')}"`;
}
