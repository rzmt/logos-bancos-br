import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { buildGalleryHtml } from '../pipeline/gallery';
import type { Dataset, PixDataset } from '../pipeline/types';

const ROOT = join(__dirname, '..');

const BLOCO_DE_DADOS = /<script id="data" type="application\/json">(.*?)<\/script>/s;

function extractRows(
  html: string,
): [string, string | null, string, string | null, number, string, string][] {
  const match = html.match(BLOCO_DE_DADOS);
  expect(match, 'bloco de dados ausente').toBeTruthy();
  return JSON.parse((match as RegExpMatchArray)[1] as string);
}

/** Elemento de DOM mínimo, só com o que o script da galeria usa. */
class FakeEl {
  readonly tag: string;
  children: FakeEl[] = [];
  className = '';
  title = '';
  alt = '';
  src = '';
  loading = '';
  href = '';
  value = '';
  checked = false;
  onclick: ((e: { preventDefault(): void }) => void) | null = null;
  listeners: Record<string, () => void> = {};
  private texto = '';

  constructor(tag: string) {
    this.tag = tag;
  }
  get textContent(): string {
    return this.texto;
  }
  set textContent(valor: string) {
    this.texto = valor;
    this.children = [];
  }
  get innerHTML(): string {
    throw new Error('a galeria não pode usar innerHTML');
  }
  set innerHTML(_valor: string) {
    throw new Error('a galeria não pode usar innerHTML');
  }
  appendChild(filho: FakeEl): FakeEl {
    if (filho.tag === '#fragment') this.children.push(...filho.children.splice(0));
    else this.children.push(filho);
    return filho;
  }
  addEventListener(tipo: string, fn: () => void): void {
    this.listeners[tipo] = fn;
  }
  focus(): void {}
}

/**
 * Roda o script da página num DOM falso, com a URL `/logos-bancos-br/<search>`.
 * Devolve os elementos que os testes olham e as URLs gravadas via replaceState.
 */
function rodarPagina(html: string, search = '') {
  const dados = html.match(BLOCO_DE_DADOS)?.[1];
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!dados || !script) throw new Error('scripts da página não encontrados');
  const data = new FakeEl('script');
  data.textContent = dados;
  const q = new FakeEl('input');
  const count = new FakeEl('p');
  const porId = new Map<string, FakeEl>([
    ['data', data],
    ['grid', new FakeEl('main')],
    ['q', q],
    ['semlogo', new FakeEl('input')],
    ['count', count],
  ]);
  const imgs: FakeEl[] = [];
  const urls: string[] = [];
  const local = { search, pathname: '/logos-bancos-br/', hash: '' };
  runInNewContext(script, {
    document: {
      getElementById: (id: string) => porId.get(id) ?? null,
      createElement: (tag: string) => {
        const el = new FakeEl(tag);
        if (tag === 'img') imgs.push(el);
        return el;
      },
      createDocumentFragment: () => new FakeEl('#fragment'),
    },
    location: local,
    history: {
      replaceState: (_estado: unknown, _titulo: string, url: string) => {
        urls.push(url);
        const i = url.indexOf('?');
        local.search = i < 0 ? '' : url.slice(i);
      },
    },
    URLSearchParams,
    navigator: {},
    setTimeout,
    clearTimeout,
  });
  return {
    q,
    count,
    imgs,
    urls,
    digitar(valor: string) {
      q.value = valor;
      q.listeners.input?.();
    },
  };
}

describe('buildGalleryHtml', () => {
  const dataset: Dataset = {
    banks: [
      {
        ispb: '00000000',
        compe: '1',
        compe4: '0001',
        name: 'Banco <script> & Cia',
        shortName: 'BCO',
        displayName: null,
        pix: null,
        logo: {
          png: 'logos/png/00000000.png',
          svg: 'logos/svg/00000000.svg',
          source: {
            type: 'openfinance',
            org: null,
            cnpj: null,
            uri: 'https://x/logo.svg',
            sha256: 'abc',
            updatedAt: '2026-01-01',
          },
        },
      },
    ],
  };
  const pixDataset: PixDataset = {
    institutions: [
      {
        ispb: '10348181',
        compe: null,
        compe4: null,
        cnpj: '10348181000100',
        name: 'Afiliada Sicredi',
        shortName: 'AFILIADA',
        displayName: null,
        pix: {
          spiParticipationType: 'Direta',
          pixParticipationType: 'Facultativa',
          modality: 'Provedor de Conta Transacional',
          institutionType: 'Cooperativa',
          authorizedByBcb: true,
        },
        logo: {
          png: 'logos/png/03795072.png',
          svg: null,
          source: {
            type: 'brand',
            org: null,
            cnpj: null,
            uri: 'https://x/logo.svg',
            sha256: 'abc',
            updatedAt: '2026-01-01',
            brand: 'SICREDI',
          },
        },
      },
    ],
  };

  it('é determinística, embute os dados e escapa "<" no JSON', () => {
    const html = buildGalleryHtml(dataset, pixDataset);
    expect(buildGalleryHtml(dataset, pixDataset)).toBe(html); // sem timestamps
    // nomes com "<" não podem quebrar o bloco <script> de dados
    expect(html).not.toContain('Banco <script>');
    const rows = extractRows(html);
    expect(rows).toHaveLength(2);
    const banco = rows.find((r) => r[0] === '00000000');
    expect(banco?.[2]).toBe('Banco <script> & Cia'); // conteúdo preservado após parse
    expect(banco?.[4]).toBe(1); // tem svg
    expect(banco?.[5]).toBe(''); // logo próprio: não agrupa
  });

  it('marca a afiliada com o sistema e o asset compartilhado, não o próprio ispb', () => {
    const rows = extractRows(buildGalleryHtml(dataset, pixDataset));
    const afiliada = rows.find((r) => r[0] === '10348181');
    expect(afiliada?.[3]).toBe('03795072'); // ispb do arquivo, não da instituição
    expect(afiliada?.[4]).toBe(0); // só png
    expect(afiliada?.[5]).toBe('SICREDI'); // agrupada no card do sistema
  });

  it('compartilha com og.png 1280x640 e cartão grande; título sem travessão', () => {
    const html = buildGalleryHtml(dataset, pixDataset);
    expect(html).toContain(
      '<meta property="og:image" content="https://rzmt.github.io/logos-bancos-br/og.png">',
    );
    expect(html).toContain('<meta property="og:image:width" content="1280">');
    expect(html).toContain('<meta property="og:image:height" content="640">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    const titulo = html.match(/<title>(.*?)<\/title>/)?.[1];
    expect(titulo).toBe('Logos de bancos brasileiros em PNG e SVG · logos-bancos-br');
    expect(titulo).not.toMatch(/[—–]/);
    expect(html).toContain(`<meta property="og:title" content="${titulo}">`);
  });

  it('não tem travessão nem meia-risca no HTML gerado', () => {
    expect(buildGalleryHtml(dataset, pixDataset)).not.toMatch(/[—–]/);
  });

  it('preenche o alt com o nome popular, o nome oficial ou a marca do sistema', () => {
    const comApelido: Dataset = {
      banks: dataset.banks.map((b) => ({ ...b, displayName: 'Banco Exemplo' })),
    };
    // sem busca: o banco tem card próprio e a afiliada entra no card do Sicredi
    const inicio = rodarPagina(buildGalleryHtml(comApelido, pixDataset));
    expect(inicio.imgs.map((img) => img.alt).sort()).toEqual(['Banco Exemplo', 'Sicredi']);
    // na busca a afiliada aparece sozinha; sem nome popular, vale o oficial
    const busca = rodarPagina(buildGalleryHtml(dataset, pixDataset), '?q=afiliada');
    expect(busca.imgs.map((img) => img.alt)).toEqual(['Afiliada Sicredi']);
  });

  it('lê a busca de ?q= e grava a busca na URL quando a digitação para', () => {
    vi.useFakeTimers();
    try {
      const pagina = rodarPagina(buildGalleryHtml(dataset, pixDataset), '?q=afiliada');
      expect(pagina.q.value).toBe('afiliada');
      expect(pagina.count.textContent).toBe('1 resultado');
      expect(pagina.urls).toEqual([]); // abrir a página não reescreve a URL
      pagina.digitar('b');
      pagina.digitar('banco');
      pagina.digitar('banco do');
      expect(pagina.urls).toEqual([]); // ainda digitando: nada gravado
      vi.advanceTimersByTime(300);
      expect(pagina.urls).toEqual(['/logos-bancos-br/?q=banco+do']);
      pagina.digitar('');
      vi.advanceTimersByTime(300);
      expect(pagina.urls.at(-1)).toBe('/logos-bancos-br/');
    } finally {
      vi.useRealTimers();
    }
  });

  it('põe o valor de ?q= no campo como texto, sem innerHTML', () => {
    const html = buildGalleryHtml(dataset, pixDataset);
    expect(html).not.toContain('innerHTML');
    const ataque = '<img src=x onerror=alert(1)>';
    const pagina = rodarPagina(html, `?q=${encodeURIComponent(ataque)}`);
    expect(pagina.q.value).toBe(ataque);
    expect(pagina.count.textContent).toBe('0 resultados');
  });
});

describe('docs/index.html (arquivo distribuído)', () => {
  it('é exatamente o que buildGalleryHtml gera a partir dos datasets', () => {
    // Mudou pipeline/gallery.ts? Regenere a página com:
    // npx tsx -e "import{readFileSync as r,writeFileSync as w}from'node:fs';import{buildGalleryHtml as g}from'./pipeline/gallery';const j=(p)=>JSON.parse(r(p,'utf8'));w('docs/index.html',g(j('data/bancos.json'),j('data/instituicoes-pix.json')))"
    const ler = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
    const esperado = buildGalleryHtml(ler('data/bancos.json'), ler('data/instituicoes-pix.json'));
    expect(readFileSync(join(ROOT, 'docs', 'index.html'), 'utf8')).toBe(esperado);
  });

  it('é consistente com os datasets', () => {
    const html = readFileSync(join(ROOT, 'docs', 'index.html'), 'utf8');
    const rows = extractRows(html);
    const banks = JSON.parse(readFileSync(join(ROOT, 'data', 'bancos.json'), 'utf8')).banks;
    const pix = JSON.parse(
      readFileSync(join(ROOT, 'data', 'instituicoes-pix.json'), 'utf8'),
    ).institutions;
    expect(rows).toHaveLength(banks.length + pix.length);
    const all = [...banks, ...pix];
    const comLogo = all.filter((i) => i.logo).length;
    expect(rows.filter((r) => r[3]).length).toBe(comLogo);
    // afiliadas de marca (agrupadas na página) batem com o dataset
    const afiliadas = all.filter((i) => i.logo?.source.type === 'brand').length;
    expect(rows.filter((r) => r[5]).length).toBe(afiliadas);
    // o nome popular curado vai junto (a busca e o rótulo usam ele)
    expect(rows.find((r) => r[0] === '18236120')?.[6]).toBe('Nubank');
    // e bate com o dataset, em vez de ser uma lista à parte na página
    const comDisplay = all.filter((i) => i.displayName).length;
    expect(rows.filter((r) => r[6]).length).toBe(comDisplay);
  });

  it('não tem travessão nem meia-risca nos textos da página', () => {
    const html = readFileSync(join(ROOT, 'docs', 'index.html'), 'utf8');
    // o bloco de dados traz os nomes oficiais do BCB, que não são texto nosso
    expect(html.replace(BLOCO_DE_DADOS, '')).not.toMatch(/[—–]/);
  });
});
