import { db, Item } from './db';

export const DEFAULT_SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1v9ORiDO9Fy0xkiXx6vxxV4UZ5rcS2bXRdz3ButABpTI';
export const DEFAULT_GID = process.env.SHEET_GID || '1585513030';

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
    index: number;
    rowCount?: number;
    columnCount?: number;
  }>;
  targetSheetName: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  source: 'GOOGLE_SHEETS' | 'LOCAL_DATABASE';
  totalSheetRows: number;
  importedItems: number;
  updatedItems: number;
  unchangedItems: number;
  sheetTitle: string;
  spreadsheetId: string;
  timestamp: string;
  errors?: string[];
}

export class GoogleSheetsService {
  private static cachedToken: { token: string; expiresAt: number } | null = null;

  /**
   * Obtém token OAuth 2.0 válido exclusivamente através do backend.
   * Suporta:
   * 1. Service Account (JWT Bearer Flow) via GOOGLE_SERVICE_ACCOUNT_KEY ou GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
   * 2. OAuth 2.0 Refresh Token via GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN
   * 3. GOOGLE_ACCESS_TOKEN direto (desenvolvimento)
   * NUNCA retorna API Keys ou valores inseguros para autenticação OAuth.
   */
  static async getValidOAuthToken(): Promise<string | null> {
    // Retorna token em cache na memória se ainda tiver mais de 60s de validade
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      return this.cachedToken.token;
    }

    // 1. Service Account credentials in backend env
    const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const saPrivateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (saKey || (saEmail && saPrivateKey)) {
      try {
        let clientEmail = saEmail;
        let privateKey = saPrivateKey;

        if (saKey) {
          try {
            const parsed = typeof saKey === 'string' && saKey.trim().startsWith('{')
              ? JSON.parse(saKey)
              : null;
            if (parsed) {
              clientEmail = parsed.client_email || clientEmail;
              privateKey = parsed.private_key || privateKey;
            }
          } catch (jsonErr) {
            console.warn('Aviso: GOOGLE_SERVICE_ACCOUNT_KEY não pôde ser analisada como JSON:', jsonErr);
          }
        }

        if (clientEmail && privateKey) {
          const jwt = await import('jsonwebtoken');
          const now = Math.floor(Date.now() / 1000);
          const claim = {
            iss: clientEmail,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
          };

          // Garante que quebras de linha em chaves RSA sejam tratadas corretamente
          const normalizedKey = privateKey.replace(/\\n/g, '\n');
          const signedJwt = jwt.default.sign(claim, normalizedKey, { algorithm: 'RS256' });

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
              assertion: signedJwt
            })
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.access_token) {
              const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600;
              this.cachedToken = {
                token: tokenData.access_token,
                expiresAt: Date.now() + (expiresIn - 120) * 1000
              };
              return tokenData.access_token;
            }
          } else {
            const errBody = await tokenRes.text();
            console.warn('Erro ao trocar JWT da Service Account por token Google:', errBody);
          }
        }
      } catch (err) {
        console.warn('Aviso: Falha ao autenticar Service Account:', err);
      }
    }

    // 2. OAuth 2.0 Refresh Token flow via backend env
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (refreshToken && clientId && clientSecret) {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
            this.cachedToken = {
              token: data.access_token,
              expiresAt: Date.now() + (expiresIn - 120) * 1000
            };
            return data.access_token;
          }
        }
      } catch (err) {
        console.warn('Aviso: Falha ao obter token via refresh_token:', err);
      }
    }

    // 3. Direct Google Access Token (desenvolvimento / teste)
    if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_ACCESS_TOKEN.trim().startsWith('ya29.')) {
      return process.env.GOOGLE_ACCESS_TOKEN.trim();
    }

    return null;
  }

  /**
   * Parser robusto de CSV para Google Sheets (suporta aspas duplas, vírgulas internas e quebras de linha)
   */
  static parseCsv(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++; // ignora aspas de escape
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\r') {
          if (nextChar === '\n') i++;
          currentRow.push(currentField);
          currentField = '';
          if (currentRow.some(c => c.trim().length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
        } else if (char === '\n') {
          currentRow.push(currentField);
          currentField = '';
          if (currentRow.some(c => c.trim().length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
        } else {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(c => c.trim().length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Obtém metadados da planilha e resolve o nome da aba correspondente ao GID fornecido.
   */
  static async getSpreadsheetMetadata(spreadsheetId: string = DEFAULT_SPREADSHEET_ID, targetGid: string = DEFAULT_GID): Promise<SheetMetadata> {
    const token = await this.getValidOAuthToken();

    // Se temos token OAuth válido no backend, consulta a API v4 oficial
    if (token) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const sheetsList = (data.sheets || []).map((s: any) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title || 'Almoxarifado',
            index: s.properties?.index || 0,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount
          }));

          const gidNum = parseInt(targetGid, 10);
          const matchedSheet = sheetsList.find((s: any) => s.sheetId === gidNum) || sheetsList[0];
          const targetSheetName = matchedSheet ? matchedSheet.title : 'Almoxarifado';

          return {
            spreadsheetId: data.spreadsheetId,
            title: data.properties?.title || 'Planilha de Almoxarifado',
            sheets: sheetsList,
            targetSheetName
          };
        }
      } catch (e) {
        console.warn('Aviso: Falha ao consultar metadados via API v4, tentando leitura via feed:', e);
      }
    }

    // Fallback gracioso: valida conexão lendo o feed do Google Sheets
    const gidNum = parseInt(targetGid, 10) || 0;
    return {
      spreadsheetId,
      title: 'Planilha de Almoxarifado (Google Sheets)',
      sheets: [{
        sheetId: gidNum,
        title: 'Almoxarifado',
        index: 0
      }],
      targetSheetName: 'Almoxarifado'
    };
  }

  /**
   * Lê todas as linhas da aba selecionada na planilha através do backend
   * Tenta primeiro via API v4 autenticada; se não houver token ou se a planilha for compartilhada publicamente,
   * utiliza o feed direto de exportação CSV do Google Sheets.
   */
  static async readSheetValues(spreadsheetId: string, sheetName: string, targetGid: string = DEFAULT_GID, range: string = 'A1:F5000'): Promise<string[][]> {
    const token = await this.getValidOAuthToken();

    // Tentativa 1: API v4 autenticada (se houver credencial no backend)
    if (token) {
      try {
        const fullRange = `${sheetName}!${range}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.values && Array.isArray(data.values) && data.values.length > 0) {
            return data.values;
          }
        }
      } catch (err) {
        console.warn('Aviso ao ler dados via Sheets API v4:', err);
      }
    }

    // Tentativa 2: Feed CSV direto e seguro do Google Sheets (não expõe chaves nem requer login)
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${targetGid}`;
      const res = await fetch(gvizUrl, {
        headers: {
          'Accept': 'text/csv,text/plain,*/*'
        }
      });

      if (res.ok) {
        const csvText = await res.text();
        const parsedRows = this.parseCsv(csvText);
        if (parsedRows.length > 0) {
          return parsedRows;
        }
      }
    } catch (gvizErr) {
      console.warn('Aviso ao consultar feed gviz da planilha:', gvizErr);
    }

    // Tentativa 3: URL de exportação direta do Google Docs
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${targetGid}`;
      const res = await fetch(exportUrl, {
        headers: {
          'Accept': 'text/csv,text/plain,*/*'
        }
      });

      if (res.ok) {
        const csvText = await res.text();
        const parsedRows = this.parseCsv(csvText);
        if (parsedRows.length > 0) {
          return parsedRows;
        }
      }
    } catch (exportErr) {
      console.warn('Aviso ao consultar exportação CSV da planilha:', exportErr);
    }

    throw new Error('Não foi possível obter os dados da planilha Google Sheets. Verifique o ID da planilha e suas permissões de acesso.');
  }

  /**
   * Classifica categoria técnica baseada na descrição do item
   */
  static classifyCategory(desc: string): string {
    const d = desc.toUpperCase();
    if (d.includes('ANEL') || d.includes('O-RING') || d.includes('ORING') || d.includes('VEDA') || 
        d.includes('GAXETA') || d.includes('SELO') || d.includes('JUNTA') || d.includes('DIAFRAGMA') || 
        d.includes('MEMBRANA') || d.includes('RETENTOR') || d.includes('ANILHA') || d.includes('BORRACHA') || 
        d.includes('VEDANTE')) {
      return 'Vedações e Juntas';
    }
    if (d.includes('FILTRO') || d.includes('AIRLINK') || d.includes('ÓLEO') || d.includes('OLEO') || 
        d.includes('GRAXA') || d.includes('MOBIL') || d.includes('THINNER') || d.includes('LUBRIFICANTE') || 
        d.includes('VASELINA') || d.includes('SPRAY') || d.includes('FLUIDO')) {
      return 'Filtros e Lubrificantes';
    }
    if (d.includes('ROLAMENTO') || d.includes('ESFERA') || d.includes('GUIA') || d.includes('EIXO') || 
        d.includes('BUCHA') || d.includes('CASQUILHO') || d.includes('CARRO GUIA') || d.includes('ARTICULADA') || 
        d.includes('CASTER') || d.includes('BUSHING') || d.includes('ROLLER')) {
      return 'Rolamentos e Guias';
    }
    if (d.includes('VÁLVULA') || d.includes('VALVULA') || d.includes('CILINDRO') || d.includes('MANIFOLD') || 
        d.includes('SILENCIADOR') || d.includes('BUJÃO') || d.includes('PLUGUE') || d.includes('SPIRAX') || 
        d.includes('PNEUMATIC') || d.includes('PNEUMATICA')) {
      return 'Pneumática e Válvulas';
    }
    if (d.includes('SENSOR') || d.includes('MANOMETRO') || d.includes('TERMOELEMENTO') || d.includes('ESCOVA CARVAO') || 
        d.includes('CABOS') || d.includes('CABO') || d.includes('FUSÍVEL') || d.includes('FUSIVEL') || 
        d.includes('RADIO') || d.includes('CARREGADOR') || d.includes('BASE CARREGADORA') || 
        d.includes('ISOLADOR') || d.includes('ELETRICO') || d.includes('ELÉTRICO') || d.includes('CONTROLADOR')) {
      return 'Sensores e Elétrica';
    }
    if (d.includes('PARAFUSO') || d.includes('ARRUELA') || d.includes('PORCA') || d.includes('CONTRA PORCA') || 
        d.includes('CAVILHA') || d.includes('PINO') || d.includes('CALÇO') || d.includes('CALCOS') || 
        d.includes('CALCO') || d.includes('PLACA') || d.includes('FLANGE') || d.includes('GRAMPO') || 
        d.includes('CHAPA') || d.includes('TAMPA') || d.includes('SUPORTE') || d.includes('BLOCO DE JUNÇÃO') || 
        d.includes('ABA DE DOBRAGEM') || d.includes('ALTURA') || d.includes('RAIL HOLDER') || d.includes('CURSOR') || 
        d.includes('MOLA') || d.includes('OLHAL') || d.includes('EMENDA') || d.includes('ARTEFATO') || 
        d.includes('16XM16') || d.includes('ORIFICE PLATE') || d.includes('FIXADOR') || d.includes('CANTONEIRA') || 
        d.includes('ELETROCALHA') || d.includes('ABRACADEIRA') || d.includes('ABRAÇADEIRA') || d.includes('ARGAMASSA') || 
        d.includes('CARDBOARD') || d.includes('DOBRADIÇA') || d.includes('MANÍPULO') || d.includes('PALHETA') || 
        d.includes('TAMPAO') || d.includes('TAMPÃO') || d.includes('CAIXA DE DERIVAÇÃO') || d.includes('HASTE') || 
        d.includes('TENSIONAMENTO')) {
      return 'Fixação e Estrutura';
    }
    if (d.includes('TUBO') || d.includes('MANGUEIRA') || d.includes('ENCAIXE') || d.includes('JUNÇÃO') || 
        d.includes('JUNÇAO') || d.includes('UNIAO') || d.includes('UNIÃO') || d.includes('ENGATE') || 
        d.includes('WINKEL') || d.includes('TERMINAÇÃO') || d.includes('CONECTOR') || d.includes('CONEXÃO') || 
        d.includes('JOELHO') || d.includes('COTOVELO') || d.includes('LUVA') || d.includes('REGISTRO') || 
        d.includes('NIPLE') || d.includes('CANINHO') || d.includes('PRENSA CABO') || d.includes('ZUGENTLASTUNG') || 
        d.includes('KABELTÜLLE')) {
      return 'Tubulações e Conexões';
    }
    if (d.includes('KIT') || d.includes('CONJUNTO') || d.includes('SORTIDO') || d.includes('PEÇA REPOSIÇÃO') || 
        d.includes('PECA REPOSICAO') || d.includes('INSERT') || d.includes('ACESSORIOS') || d.includes('855617064/SIG') || 
        d.includes('QIR-')) {
      return 'Kits e Peças Sobressalentes';
    }
    if (d.includes('FERRAMENTA') || d.includes('CHAVE') || d.includes('GABARITO') || d.includes('ASSEMBLY') || 
        d.includes('EXTRACTOR') || d.includes('VARA DE MANOBRA')) {
      return 'Ferramentas e Gabaritos';
    }
    return 'Fixação e Estrutura';
  }

  /**
   * Converte texto de quantidade em número e unidade
   */
  static parseQuantityAndUnit(qtyStr: string, desc: string): { quantity: number; unit: string } {
    if (!qtyStr || !qtyStr.trim()) {
      return { quantity: 0, unit: 'UN' };
    }
    const clean = qtyStr.trim().toUpperCase();
    if (clean.includes('KITS') || clean.includes('KIT')) {
      const num = parseInt(clean.replace(/[^0-9]/g, ''), 10) || 1;
      return { quantity: num, unit: 'KIT' };
    }
    if (clean.includes('CX') || clean.includes('CAIXA')) {
      const num = parseInt(clean.replace(/[^0-9]/g, ''), 10) || 1;
      return { quantity: num, unit: 'CX' };
    }
    if (desc.toUpperCase().includes('20L') || desc.toUpperCase().includes('10L') || desc.toUpperCase().includes('TAMBOR')) {
      const num = parseInt(clean.replace(/[^0-9]/g, ''), 10) || 1;
      return { quantity: num, unit: 'GL' };
    }
    const num = parseInt(clean.replace(/[^0-9]/g, ''), 10) || 0;
    return { quantity: num, unit: 'UN' };
  }

  /**
   * Sincronização SHEETS ➔ SISTEMA (Puxa dados da Google Sheet e atualiza o banco de dados)
   */
  static async syncFromGoogleSheets(spreadsheetId: string = DEFAULT_SPREADSHEET_ID, targetGid: string = DEFAULT_GID): Promise<SyncResult> {
    const meta = await this.getSpreadsheetMetadata(spreadsheetId, targetGid);
    const rows = await this.readSheetValues(spreadsheetId, meta.targetSheetName, targetGid, 'A1:F5000');

    if (rows.length <= 1) {
      return {
        success: true,
        message: 'Planilha lida com sucesso, porém não contém linhas de dados após o cabeçalho.',
        source: 'GOOGLE_SHEETS',
        totalSheetRows: 0,
        importedItems: 0,
        updatedItems: 0,
        unchangedItems: 0,
        sheetTitle: meta.targetSheetName,
        spreadsheetId,
        timestamp: new Date().toISOString()
      };
    }

    const header = rows[0].map(h => (h || '').trim().toUpperCase());
    const dataRows = rows.slice(1);

    // Identifica índices das colunas de forma tolerante a variações
    let colCode = header.findIndex(h => h.includes('CODIGO') || h.includes('CÓDIGO') || h.includes('TETRA'));
    let colBusca = header.findIndex(h => h.includes('BUSCA') || h.includes('FABRICANTE') || h.includes('KLASSMATT'));
    let colQty = header.findIndex(h => h.includes('QUANTIDADE') || h.includes('QTD') || h.includes('ESTOQUE'));
    let colDesc = header.findIndex(h => h.includes('DESCRIÇÃO') || h.includes('DESCRICAO') || h.includes('NOME') || h.includes('ITEM'));
    let colPrat = header.findIndex(h => h.includes('PRATELEIRA') || h.includes('LOCAL') || h.includes('POSIÇÃO'));
    let colData = header.findIndex(h => h.includes('DATA'));

    if (colCode === -1) colCode = 0;
    if (colBusca === -1) colBusca = 1;
    if (colQty === -1) colQty = 2;
    if (colDesc === -1) colDesc = 3;
    if (colPrat === -1) colPrat = 4;
    if (colData === -1) colData = 5;

    let importedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    const currentItems = db.getItems(false); // inclui inativos para conciliação
    const itemsMapByCode = new Map<string, Item>();
    const itemsMapById = new Map<string, Item>();
    const itemsMapByName = new Map<string, Item>();

    currentItems.forEach(i => {
      itemsMapById.set(i.id, i);
      if (i.code) {
        itemsMapByCode.set(i.code.toUpperCase().trim(), i);
      }
      if (i.name) {
        itemsMapByName.set(i.name.toUpperCase().trim(), i);
      }
    });

    dataRows.forEach((row, index) => {
      const rawCode = (row[colCode] || '').trim();
      const rawBusca = (row[colBusca] || '').trim();
      const rawQty = (row[colQty] || '').trim();
      const rawDesc = (row[colDesc] || '').trim();
      const rawPrat = (row[colPrat] || '').trim();
      const rawData = (row[colData] || '').trim();

      if (!rawDesc && !rawCode) return; // ignora linhas vazias

      const { quantity, unit } = this.parseQuantityAndUnit(rawQty, rawDesc);
      
      let code = rawCode;
      if (!code || code.toUpperCase() === 'NULL') {
        code = `ALM-${rawPrat.replace(/[^A-Za-z0-9]/g, '')}-${String(index + 1).padStart(3, '0')}`;
      }

      const category = this.classifyCategory(rawDesc);
      let location = rawPrat.toUpperCase() === 'SOLTO' 
        ? 'Área de Tambores e Fluidos (SOLTO)' 
        : `Prateleira ${rawPrat}`;
      
      const minStock = quantity > 20 ? 5 : (quantity > 5 ? 2 : (quantity > 0 ? 1 : 0));
      const description = `Fabricante/Sistema: ${rawBusca || 'KLASSMATT'} | Cadastro: ${rawData || '8/26/2026'} | Posição: ${rawPrat}`;

      // Localiza item existente por ID determinístico, código ou nome normalizado
      const candidateId = `item_sheet_${index + 1}`;
      const existing = 
        itemsMapById.get(candidateId) || 
        itemsMapByCode.get(code.toUpperCase().trim()) ||
        itemsMapByName.get(rawDesc.toUpperCase().trim());

      if (existing) {
        const hasChanges = 
          existing.name !== rawDesc ||
          existing.quantity !== quantity ||
          existing.location !== location ||
          existing.code !== code ||
          !existing.active;

        if (hasChanges) {
          db.updateItem(
            existing.id,
            {
              name: rawDesc || existing.name,
              code,
              category,
              quantity,
              minStock: existing.minStock ?? minStock,
              unit,
              location,
              description
            },
            'SYSTEM_SYNC',
            'Sincronização Google Sheets'
          );
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        db.createItem(
          {
            name: rawDesc || `Item ${code}`,
            code,
            category,
            quantity,
            minStock,
            unit,
            location,
            description
          },
          'SYSTEM_SYNC',
          'Sincronização Google Sheets'
        );
        importedCount++;
      }
    });

    db.addLog({
      action: 'SINCRONIZACAO_SHEETS_RECEBIDA',
      details: `Sincronização Google Sheets ➔ Sistema concluída com sucesso: ${importedCount} importados, ${updatedCount} atualizados, ${unchangedCount} inalterados da aba "${meta.targetSheetName}".`,
      userName: 'Google Sheets Integration'
    });

    return {
      success: true,
      message: `Sincronização Google Sheets ➔ Sistema concluída com sucesso! ${updatedCount} itens atualizados e ${importedCount} novos itens importados da aba "${meta.targetSheetName}".`,
      source: 'GOOGLE_SHEETS',
      totalSheetRows: dataRows.length,
      importedItems: importedCount,
      updatedItems: updatedCount,
      unchangedItems: unchangedCount,
      sheetTitle: meta.targetSheetName,
      spreadsheetId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sincronização SISTEMA ➔ SHEETS (Envia dados do Almoxarifado para a Google Sheet)
   * Requer credenciais no backend (Service Account ou OAuth2).
   * Atualiza linhas existentes pelo código e adiciona novas linhas sem duplicar.
   */
  static async syncToGoogleSheets(spreadsheetId: string = DEFAULT_SPREADSHEET_ID, targetGid: string = DEFAULT_GID): Promise<SyncResult> {
    const token = await this.getValidOAuthToken();

    if (!token) {
      throw new Error(
        'Para enviar dados do estoque para a planilha Google Sheets, configure as credenciais da Conta de Serviço (Service Account) ou OAuth no arquivo .env do servidor (GOOGLE_SERVICE_ACCOUNT_KEY ou GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).'
      );
    }

    const meta = await this.getSpreadsheetMetadata(spreadsheetId, targetGid);
    const activeItems = db.getItems(true);

    // Lê linhas existentes na planilha para conciliação sem duplicatas
    let existingRows: string[][] = [];
    try {
      existingRows = await this.readSheetValues(spreadsheetId, meta.targetSheetName, targetGid, 'A1:F5000');
    } catch {
      existingRows = [];
    }

    const headers = ['CODIGO TETRA PAK', 'BUSCA', 'QUANTIDADE', 'DESCRIÇÃO', 'PRATELEIRA', 'DATA'];
    const rows: string[][] = existingRows.length > 0 ? [...existingRows] : [headers];
    if (rows.length === 0) {
      rows.push(headers);
    }

    // Mapeia código para índice da linha existente na planilha
    const codeToRowMap = new Map<string, number>();
    for (let i = 1; i < rows.length; i++) {
      const rowCode = (rows[i][0] || '').trim().toUpperCase();
      if (rowCode && rowCode !== 'NULL') {
        codeToRowMap.set(rowCode, i);
      }
    }

    let updatedCount = 0;
    let newItemsCount = 0;

    activeItems.forEach(item => {
      let prateleira = 'P1-A1';
      if (item.location.includes('Prateleira ')) {
        prateleira = item.location.replace('Prateleira ', '').trim();
      } else if (item.location.includes('SOLTO')) {
        prateleira = 'SOLTO';
      }

      let busca = 'KLASSMATT';
      if (item.code.startsWith('6-') || item.name.toUpperCase().includes('TETRAPAK') || item.name.toUpperCase().includes('TETRA PAK')) {
        busca = 'TETRA PAK';
      }

      let date = '8/26/2026';
      if (item.description && item.description.includes('Cadastro: ')) {
        const match = item.description.match(/Cadastro:\s*([^|]+)/);
        if (match && match[1]) {
          date = match[1].trim();
        }
      }

      let qtyDisplay = String(item.quantity);
      if (item.unit === 'KIT' && item.quantity > 0) {
        qtyDisplay = `${item.quantity} KITS`;
      } else if (item.unit === 'CX' && item.quantity > 0) {
        qtyDisplay = `${item.quantity} CX`;
      }

      const codeVal = item.code.startsWith('ALM-') ? 'NULL' : item.code;
      const normalizedCode = codeVal.trim().toUpperCase();
      const rowData = [codeVal, busca, qtyDisplay, item.name, prateleira, date];

      if (normalizedCode !== 'NULL' && codeToRowMap.has(normalizedCode)) {
        // Atualiza linha existente correspondente
        const existingIndex = codeToRowMap.get(normalizedCode)!;
        rows[existingIndex] = rowData;
        updatedCount++;
      } else {
        // Cria nova linha na planilha evitando duplicação
        rows.push(rowData);
        if (normalizedCode !== 'NULL') {
          codeToRowMap.set(normalizedCode, rows.length - 1);
        }
        newItemsCount++;
      }
    });

    const range = `${meta.targetSheetName}!A1:F${rows.length}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = `Falha ao gravar dados na planilha (${response.status}): ${response.statusText}`;
      try {
        const json = JSON.parse(errText);
        if (json.error?.message) {
          msg = json.error.message;
        }
      } catch {}
      throw new Error(msg);
    }

    db.addLog({
      action: 'SINCRONIZACAO_SHEETS_ENVIADA',
      details: `Sincronização Sistema ➔ Google Sheets concluída com sucesso: ${updatedCount} itens existentes atualizados, ${newItemsCount} novos registros criados sem duplicatas na aba "${meta.targetSheetName}".`,
      userName: 'Google Sheets Integration'
    });

    return {
      success: true,
      message: `Dados gravados com sucesso na planilha "${meta.title}" (${meta.targetSheetName}). ${updatedCount} atualizados e ${newItemsCount} novos criados.`,
      source: 'LOCAL_DATABASE',
      totalSheetRows: rows.length - 1,
      importedItems: newItemsCount,
      updatedItems: updatedCount,
      unchangedItems: 0,
      sheetTitle: meta.targetSheetName,
      spreadsheetId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sincronização Bidirecional completa
   * 1. Puxa dados da planilha para o sistema (garante que tudo que foi alterado na planilha venha para o sistema)
   * 2. Se as credenciais do backend estiverem configuradas, envia a base conciliada de volta para a planilha.
   */
  static async syncBidirectional(spreadsheetId: string = DEFAULT_SPREADSHEET_ID, targetGid: string = DEFAULT_GID): Promise<any> {
    // Passo 1: Puxa alterações da planilha para o sistema
    const pullResult = await this.syncFromGoogleSheets(spreadsheetId, targetGid);

    // Passo 2: Verifica se há credenciais no backend para gravação
    const token = await this.getValidOAuthToken();

    if (!token) {
      return {
        success: true,
        configured: false,
        source: 'GOOGLE_SHEETS_FEED',
        message: `Sincronização Google Sheets ➔ Sistema realizada com sucesso! (${pullResult.updatedItems} atualizados, ${pullResult.importedItems} importados). Para habilitar a gravação de volta na nuvem do Google Sheets, configure a Service Account no .env do servidor.`,
        pullResult,
        pushResult: {
          importedItems: 0,
          updatedItems: 0,
          unchangedItems: db.getItems(true).length
        },
        timestamp: new Date().toISOString()
      };
    }

    // Se temos credencial, envia o estado consolidado para a planilha
    const pushResult = await this.syncToGoogleSheets(spreadsheetId, targetGid);

    db.addLog({
      action: 'SINCRONIZACAO_BIDIRECIONAL_CONCLUIDA',
      details: `Sincronização bidirecional completa: ${pullResult.importedItems} novos itens importados da planilha, ${pullResult.updatedItems} atualizados no sistema e ${pushResult.updatedItems} registros consolidados no Google Sheets.`,
      userName: 'Google Sheets Integration'
    });

    return {
      success: true,
      configured: true,
      source: 'GOOGLE_SHEETS_OAUTH',
      message: `Sincronização bidirecional concluída com sucesso entre o Sistema e a Google Sheet! (${pullResult.updatedItems} atualizados no app, ${pushResult.updatedItems} na planilha).`,
      pullResult,
      pushResult,
      timestamp: new Date().toISOString()
    };
  }
}
