/**
 * @deprecated
 * A autenticação com o Google Sheets foi totalmente migrada para o backend por motivos de segurança.
 * O frontend não manipula nem armazena tokens ou credenciais da API do Google Sheets.
 * Todas as operações são realizadas de forma segura através dos endpoints do servidor (/api/sheets/*).
 */

export const getGoogleAccessToken = (): string | null => null;
export const googleSignIn = async () => { throw new Error('Autenticação gerenciada pelo backend.'); };
export const googleSignOut = async () => {};
