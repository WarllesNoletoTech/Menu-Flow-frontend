export type CatalogTemplateId = 'pizzaria' | 'restaurante' | 'marmitaria' | 'hamburgueria' | 'acai' | 'sushi' | 'cafeteria' | 'bar';

export type PresetAddon = { name: string; price: number };
export type PresetGroup = { name: string; required: boolean; min: number; max: number; pricingMode?: 'SUM' | 'MAX'; addons: PresetAddon[] };
export type ProductOptionPreset = {
  id: string;
  label: string;
  icon: string;
  description: string;
  hint: string;
  groups: PresetGroup[];
};

export type CatalogTemplate = {
  id: CatalogTemplateId;
  label: string;
  icon: string;
  description: string;
  categories: string[];
  recommendedPresetIds: string[];
};

export type CatalogImportRow = {
  line: number;
  category: string;
  name: string;
  description: string;
  price: number;
  promotionalPrice?: number;
  presetId?: string;
  available: boolean;
  featured: boolean;
};

export type CatalogImportResult = { rows: CatalogImportRow[]; errors: string[] };

export const PRODUCT_OPTION_PRESETS: ProductOptionPreset[] = [
  {
    id: 'pizza', label: 'Pizza', icon: '🍕',
    description: 'Tamanho, até 2 sabores e bordas com cobrança pelo sabor mais caro.',
    hint: 'Use o preço do menor tamanho como base. Nos sabores, informe o acréscimo de cada sabor: se o cliente escolher mais de um, o Menu Flow cobra somente o maior acréscimo.',
    groups: [
      { name: 'Tamanho', required: true, min: 1, max: 1, addons: [{ name: 'Pequena', price: 0 }, { name: 'Média', price: 10 }, { name: 'Grande', price: 20 }, { name: 'Família', price: 30 }] },
      { name: 'Sabores', required: true, min: 1, max: 2, pricingMode: 'MAX', addons: [{ name: 'Calabresa', price: 0 }, { name: 'Frango com catupiry', price: 0 }, { name: 'Portuguesa', price: 0 }, { name: 'Marguerita', price: 0 }] },
      { name: 'Borda', required: false, min: 0, max: 1, addons: [{ name: 'Borda de catupiry', price: 8 }, { name: 'Borda de cheddar', price: 8 }, { name: 'Borda de chocolate', price: 10 }] },
    ],
  },
  {
    id: 'almoco', label: 'Almoço / Executivo', icon: '🍛',
    description: 'Proteína, acompanhamentos e itens para retirar.',
    hint: 'Ajuste a quantidade máxima de acompanhamentos conforme a regra do restaurante.',
    groups: [
      { name: 'Proteína', required: true, min: 1, max: 1, addons: [{ name: 'Frango grelhado', price: 0 }, { name: 'Bife acebolado', price: 3 }, { name: 'Linguiça', price: 0 }, { name: 'Peixe', price: 5 }] },
      { name: 'Acompanhamentos', required: true, min: 1, max: 4, addons: [{ name: 'Arroz', price: 0 }, { name: 'Feijão', price: 0 }, { name: 'Macarrão', price: 0 }, { name: 'Farofa', price: 0 }, { name: 'Salada', price: 0 }, { name: 'Purê', price: 0 }] },
      { name: 'Retirar do prato', required: false, min: 0, max: 4, addons: [{ name: 'Sem cebola', price: 0 }, { name: 'Sem salada', price: 0 }, { name: 'Sem feijão', price: 0 }, { name: 'Sem farofa', price: 0 }] },
    ],
  },
  {
    id: 'marmita', label: 'Marmita', icon: '🍱',
    description: 'Tamanho, proteína e acompanhamentos.',
    hint: 'O preço base pode ser o da marmita pequena; tamanhos maiores entram como acréscimo.',
    groups: [
      { name: 'Tamanho da marmita', required: true, min: 1, max: 1, addons: [{ name: 'Pequena', price: 0 }, { name: 'Média', price: 5 }, { name: 'Grande', price: 10 }] },
      { name: 'Proteína da marmita', required: true, min: 1, max: 1, addons: [{ name: 'Frango', price: 0 }, { name: 'Bife', price: 3 }, { name: 'Linguiça', price: 0 }, { name: 'Peixe', price: 5 }] },
      { name: 'Acompanhamentos da marmita', required: true, min: 1, max: 4, addons: [{ name: 'Arroz branco', price: 0 }, { name: 'Feijão carioca', price: 0 }, { name: 'Macarrão simples', price: 0 }, { name: 'Farofa caseira', price: 0 }, { name: 'Salada simples', price: 0 }] },
    ],
  },
  {
    id: 'hamburguer', label: 'Hambúrguer', icon: '🍔',
    description: 'Ponto, adicionais, retirada de ingredientes e combo.',
    hint: 'Remova grupos que não fizerem sentido para o seu produto.',
    groups: [
      { name: 'Ponto da carne', required: false, min: 0, max: 1, addons: [{ name: 'Carne ao ponto', price: 0 }, { name: 'Carne bem passada', price: 0 }] },
      { name: 'Adicionais do lanche', required: false, min: 0, max: 4, addons: [{ name: 'Bacon extra', price: 4 }, { name: 'Queijo extra', price: 3 }, { name: 'Ovo extra', price: 2 }, { name: 'Carne extra', price: 8 }] },
      { name: 'Retirar do lanche', required: false, min: 0, max: 4, addons: [{ name: 'Sem cebola no lanche', price: 0 }, { name: 'Sem tomate no lanche', price: 0 }, { name: 'Sem alface no lanche', price: 0 }, { name: 'Sem molho no lanche', price: 0 }] },
      { name: 'Transformar em combo', required: false, min: 0, max: 1, addons: [{ name: 'Combo com batata e refrigerante', price: 12 }] },
    ],
  },
  {
    id: 'acai', label: 'Açaí / Sorvete', icon: '🥤',
    description: 'Tamanhos, acompanhamentos grátis e adicionais premium.',
    hint: 'Ajuste o limite de acompanhamentos grátis para a regra da loja.',
    groups: [
      { name: 'Tamanho do copo', required: true, min: 1, max: 1, addons: [{ name: '300 ml', price: 0 }, { name: '500 ml', price: 5 }, { name: '700 ml', price: 9 }, { name: '1 litro', price: 15 }] },
      { name: 'Acompanhamentos grátis', required: false, min: 0, max: 4, addons: [{ name: 'Banana', price: 0 }, { name: 'Granola', price: 0 }, { name: 'Leite em pó', price: 0 }, { name: 'Paçoca', price: 0 }] },
      { name: 'Adicionais premium', required: false, min: 0, max: 4, addons: [{ name: 'Nutella', price: 4 }, { name: 'Morango', price: 3 }, { name: 'Creme de ninho', price: 4 }, { name: 'Ovomaltine', price: 3 }] },
    ],
  },
  {
    id: 'sushi', label: 'Japonês / Sushi', icon: '🍣',
    description: 'Escolhas para combos, temakis e adicionais.',
    hint: 'Para combos fechados, você pode simplesmente não usar grupos de opções.',
    groups: [
      { name: 'Montagem do combo', required: true, min: 1, max: 3, addons: [{ name: 'Hot roll', price: 0 }, { name: 'Uramaki salmão', price: 0 }, { name: 'Hossomaki', price: 0 }, { name: 'Sashimi', price: 5 }] },
      { name: 'Adicionais japoneses', required: false, min: 0, max: 3, addons: [{ name: 'Cream cheese extra', price: 3 }, { name: 'Gengibre extra', price: 2 }, { name: 'Tarê extra', price: 2 }] },
    ],
  },
  {
    id: 'bebida', label: 'Bebida', icon: '🥤',
    description: 'Tamanho ou volume da bebida.',
    hint: 'Útil para sucos, refrigerantes, cafés e bebidas preparadas.',
    groups: [
      { name: 'Tamanho da bebida', required: true, min: 1, max: 1, addons: [{ name: '300 ml bebida', price: 0 }, { name: '500 ml bebida', price: 3 }, { name: '700 ml bebida', price: 5 }] },
    ],
  },
];

export const CATALOG_TEMPLATES: CatalogTemplate[] = [
  { id: 'pizzaria', label: 'Pizzaria', icon: '🍕', description: 'Estrutura pronta para pizzas, bordas, bebidas e sobremesas.', categories: ['Pizzas', 'Pizzas doces', 'Bebidas', 'Sobremesas'], recommendedPresetIds: ['pizza', 'bebida'] },
  { id: 'restaurante', label: 'Almoço / Restaurante', icon: '🍛', description: 'Pratos do dia, executivos, porções, bebidas e sobremesas.', categories: ['Pratos do dia', 'Executivos', 'Porções', 'Bebidas', 'Sobremesas'], recommendedPresetIds: ['almoco', 'bebida'] },
  { id: 'marmitaria', label: 'Marmitaria', icon: '🍱', description: 'Marmitas por tamanho, proteínas, adicionais e bebidas.', categories: ['Marmitas', 'Combos', 'Adicionais', 'Bebidas'], recommendedPresetIds: ['marmita', 'bebida'] },
  { id: 'hamburgueria', label: 'Hamburgueria', icon: '🍔', description: 'Hambúrgueres, combos, porções, bebidas e sobremesas.', categories: ['Hambúrgueres', 'Combos', 'Porções', 'Bebidas', 'Sobremesas'], recommendedPresetIds: ['hamburguer', 'bebida'] },
  { id: 'acai', label: 'Açaí / Sorveteria', icon: '🥤', description: 'Copos, cremes, adicionais, sorvetes e bebidas.', categories: ['Açaí', 'Cremes', 'Sorvetes', 'Adicionais', 'Bebidas'], recommendedPresetIds: ['acai', 'bebida'] },
  { id: 'sushi', label: 'Japonês / Sushi', icon: '🍣', description: 'Combos, temakis, hot rolls, sashimis e bebidas.', categories: ['Combos', 'Temakis', 'Hot rolls', 'Sashimis', 'Bebidas'], recommendedPresetIds: ['sushi', 'bebida'] },
  { id: 'cafeteria', label: 'Cafeteria / Padaria', icon: '☕', description: 'Cafés, bebidas, salgados, doces e combos.', categories: ['Cafés', 'Bebidas', 'Salgados', 'Doces', 'Combos'], recommendedPresetIds: ['bebida'] },
  { id: 'bar', label: 'Bar / Petiscos', icon: '🍻', description: 'Petiscos, porções, pratos, bebidas e combos.', categories: ['Petiscos', 'Porções', 'Pratos', 'Bebidas', 'Combos'], recommendedPresetIds: ['bebida'] },
];

export function findProductPreset(id?: string) {
  return id ? PRODUCT_OPTION_PRESETS.find((preset) => preset.id === id) : undefined;
}

export function catalogImportExample() {
  return [
    'Categoria;Produto;Descrição;Preço;Preço promocional;Modelo de opções;Disponível;Destaque',
    'Hambúrgueres;X-Bacon;Pão, carne, queijo e bacon;25,00;;hamburguer;sim;sim',
    'Bebidas;Coca-Cola 350 ml;Lata gelada;6,00;;;sim;não',
    'Pizzas;Pizza Tradicional;Escolha o tamanho e os sabores;35,00;;pizza;sim;sim',
  ].join('\n');
}

function clean(value: string | undefined) { return (value ?? '').trim(); }
function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function moneyNumber(value: string) {
  const normalized = value.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : NaN;
}
function boolValue(value: string, fallback: boolean) {
  const normalized = normalizeHeader(value);
  if (!normalized) return fallback;
  return ['sim', 's', 'true', '1', 'ativo', 'disponivel'].includes(normalized);
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { values.push(current.trim()); current = ''; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function detectDelimiter(line: string) {
  const candidates = [';', '\t', ','];
  return candidates.map((delimiter) => ({ delimiter, count: splitCsvLine(line, delimiter).length })).sort((a, b) => b.count - a.count)[0].delimiter;
}

export function parseCatalogImport(text: string): CatalogImportResult {
  const sourceLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = sourceLines.map((value, index) => ({ value: value.trim(), line: index + 1 })).filter((item) => item.value);
  if (!nonEmpty.length) return { rows: [], errors: [] };

  const first = nonEmpty[0].value;
  const delimiter = detectDelimiter(first);
  const firstCells = splitCsvLine(first, delimiter);
  const normalizedHeaders = firstCells.map(normalizeHeader);
  const hasHeader = normalizedHeaders.some((header) => ['categoria', 'produto', 'nome', 'preco', 'price'].includes(header));

  if (!hasHeader) return parsePlainMenu(nonEmpty);

  const aliases: Record<string, string[]> = {
    category: ['categoria', 'category'], name: ['produto', 'nome', 'product'], description: ['descricao', 'description'],
    price: ['preco', 'price', 'valor'], promotionalPrice: ['preco_promocional', 'promocional', 'promotion'],
    presetId: ['modelo_de_opcoes', 'modelo', 'preset'], available: ['disponivel', 'ativo', 'available'], featured: ['destaque', 'featured'],
  };
  const indexOf = (key: keyof typeof aliases) => normalizedHeaders.findIndex((header) => aliases[key].includes(header));
  const indexes = { category: indexOf('category'), name: indexOf('name'), description: indexOf('description'), price: indexOf('price'), promotionalPrice: indexOf('promotionalPrice'), presetId: indexOf('presetId'), available: indexOf('available'), featured: indexOf('featured') };
  const errors: string[] = [];
  if (indexes.category < 0 || indexes.name < 0 || indexes.price < 0) errors.push('A planilha precisa ter as colunas Categoria, Produto e Preço.');
  if (errors.length) return { rows: [], errors };

  const rows: CatalogImportRow[] = [];
  for (const item of nonEmpty.slice(1, 501)) {
    const cells = splitCsvLine(item.value, delimiter);
    const category = clean(cells[indexes.category]);
    const name = clean(cells[indexes.name]);
    const price = moneyNumber(clean(cells[indexes.price]));
    if (!category || !name || !Number.isFinite(price) || price < 0) {
      errors.push(`Linha ${item.line}: informe categoria, produto e um preço válido.`);
      continue;
    }
    const promoRaw = indexes.promotionalPrice >= 0 ? clean(cells[indexes.promotionalPrice]) : '';
    const promotionalPrice = promoRaw ? moneyNumber(promoRaw) : undefined;
    if (promotionalPrice !== undefined && (!Number.isFinite(promotionalPrice) || promotionalPrice < 0 || promotionalPrice > price)) {
      errors.push(`Linha ${item.line}: preço promocional inválido.`);
      continue;
    }
    const presetRaw = indexes.presetId >= 0 ? normalizeHeader(clean(cells[indexes.presetId])) : '';
    const presetId = presetRaw ? (presetRaw === 'hamburgueria' ? 'hamburguer' : presetRaw === 'restaurante' ? 'almoco' : presetRaw) : undefined;
    if (presetId && !findProductPreset(presetId)) errors.push(`Linha ${item.line}: modelo de opções “${cells[indexes.presetId]}” não existe; o produto será importado sem modelo.`);
    rows.push({ line: item.line, category, name, description: indexes.description >= 0 ? clean(cells[indexes.description]) : '', price, promotionalPrice, presetId: presetId && findProductPreset(presetId) ? presetId : undefined, available: indexes.available >= 0 ? boolValue(clean(cells[indexes.available]), true) : true, featured: indexes.featured >= 0 ? boolValue(clean(cells[indexes.featured]), false) : false });
  }
  if (nonEmpty.length > 501) errors.push('A importação aceita até 500 produtos por vez. O restante não foi incluído.');
  return { rows, errors };
}

function parsePlainMenu(lines: Array<{ value: string; line: number }>): CatalogImportResult {
  const rows: CatalogImportRow[] = [];
  const errors: string[] = [];
  let category = 'Outros';
  for (const item of lines.slice(0, 500)) {
    const line = item.value;
    const categoryMatch = line.match(/^\[?([^\]]+?)\]?:$/);
    if (categoryMatch && !/\d/.test(categoryMatch[1])) { category = categoryMatch[1].trim(); continue; }
    const match = line.match(/^(.+?)(?:\s+[\-–—|]\s+)(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s+[\-–—|]\s+(.+))?$/i);
    if (!match) { errors.push(`Linha ${item.line}: não consegui identificar produto e preço. Use “Produto - 25,00” ou o modelo CSV.`); continue; }
    const price = moneyNumber(match[2]);
    if (!Number.isFinite(price) || price < 0) { errors.push(`Linha ${item.line}: preço inválido.`); continue; }
    rows.push({ line: item.line, category, name: match[1].trim(), description: clean(match[3]), price, available: true, featured: false });
  }
  return { rows, errors };
}
