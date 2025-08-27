/**
 * ATENÇÃO: Este é um armazenamento de dados em memória APENAS para fins de
 * desenvolvimento.
 */

interface Store {
    checkoutToEmail: Record<string, string>;
    userCredits: Record<string, number>;
}

export const memoryStore: Store = {
    checkoutToEmail: {},
    userCredits: {},
};
