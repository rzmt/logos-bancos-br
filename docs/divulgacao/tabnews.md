<!-- Onde postar: tabnews.com.br (categoria Pitch). Copiar do título para baixo. -->

# Pitch: dataset + logos das instituições financeiras do Brasil, usando só fontes oficiais (BCB e Open Finance)

Quem já precisou mostrar "de qual instituição veio esse Pix" dentro de um app conhece o problema: não existe uma fonte boa para logos de bancos e fintechs. O que se acha são listas em repositórios parados há anos, ou pacotes de ícones coletados à mão de sites aleatórios — sem nenhuma garantia de que aquele logo é mesmo daquela instituição, nem de que continua sendo o logo atual.

Passei as últimas semanas atacando isso e o resultado é open source:

**[logos-bancos-br](https://github.com/rzmt/logos-bancos-br)** — `npm install logos-bancos-br`

## A ideia

Em vez de coletar logos manualmente, tudo é derivado de três fontes públicas e oficiais:

- a [lista de participantes do STR](https://www.bcb.gov.br/estabilidadefinanceira/participantesstr) do Banco Central ([CSV](https://www.bcb.gov.br/content/estabilidadefinanceira/str1/ParticipantesSTR.csv)) — ISPB, código COMPE e nomes oficiais das 470 instituições com código de banco;
- a [lista de participantes ativos do Pix](https://www.bcb.gov.br/estabilidadefinanceira/participantespix), também do BCB — acrescenta as 643 instituições que não têm código COMPE (fintechs, IPs, cooperativas afiliadas);
- o [diretório de participantes do Open Finance Brasil](https://data.directory.openbankingbrasil.org.br/participants) — onde cada instituição publica e mantém o próprio logo, identificada por CNPJ.

A ponte entre as fontes é uma propriedade pouco comentada: o ISPB de uma instituição é, na esmagadora maioria dos casos, os 8 primeiros dígitos do CNPJ dela. Isso permite casar a lista do BCB com o diretório do Open Finance sem heurística nenhuma.

Um GitHub Action roda toda segunda-feira, reconstrói lista e logos a partir das fontes e abre um PR com o diff visual dos PNGs (o GitHub renderiza a comparação de imagem). Cada logo carrega proveniência no dataset: a URI de onde foi baixado, o SHA-256 do arquivo original e a data. O diff do git é a auditoria.

## As decisões que deram mais trabalho

**Logo errado é pior que logo nenhum.** Em contexto de pagamento, exibir o logo do banco errado é grave. Então semelhança de nome nunca atribui logo automaticamente — vira uma sugestão num relatório, que um humano revisa e promove (ou não) para uma regra explícita no config. Só o match exato por ISPB entra sozinho. Essa regra me salvou algumas vezes: o pipeline chegou a sugerir um "Kanastra" hospedado num marketplace de domínios e o logo do Méliuz para o Banco Votorantim (a organização do BV lista o parceiro no diretório).

**Repetição polui.** 315 cooperativas afiliadas (Sicoob, Sicredi, Cresol, Unicred) usam o logo do sistema — na primeira versão isso virou centenas de PNGs byte-idênticos e uma galeria cheia de cata-vento repetido. Hoje as afiliadas referenciam **um único arquivo por sistema** (473 instituições com logo em 160 arquivos, ~1,7 MB) e são marcadas com `logo.source.type: "brand"`, para quem quiser filtrar logo próprio de logo herdado.

**Lista principal separada.** As 643 instituições só-Pix ficam num dataset próprio (`data/instituicoes-pix.json`); `data/bancos.json` segue enxuto, com as 470 de código COMPE. A API resolve nos dois: `byIspb()` acha uma afiliada de cooperativa do mesmo jeito que acha o Itaú.

**SVG de terceiro é input hostil.** Todo SVG passa por sanitização antes de ser redistribuído (nada de `script`, event handlers, `foreignObject` ou referência externa); download só via https, com teto de tamanho e de pixels. Reprovou, distribui-se só o PNG rasterizado.

## Na prática

```ts
import { banks, pixInstitutions, byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';

byCompe(341);        // Itaú — nomes oficiais, ISPB, logo com proveniência
byIspb('11275560');  // RecargaPay — só-Pix, sem código de banco
logoCdnUrl(260);     // URL do jsDelivr pinada na versão do pacote
```

- React Native: `import logos from 'logos-bancos-br/react-native'` (mapa `require()` pronto para o Metro);
- Flutter/Kotlin/Swift/qualquer stack: `npx logos-bancos-br copy --dest ./assets/banks`;
- sem instalar nada: `https://cdn.jsdelivr.net/npm/logos-bancos-br@0.4.0/logos/png/60701190.png`;
- só os dados: `logos-bancos-br/data/bancos.json`.

## Limitações, para ser honesto

- 473 das 1.113 instituições têm logo. As demais são SCDs, corretoras e IPs pequenas que não publicam marca em lugar oficial nenhum — para elas o app usa o fallback que preferir.
- A cobertura depende do ecossistema: quando uma instituição entra no Open Finance ou publica logo no site oficial, o pipeline pega na semana seguinte.
- Os logos são marcas das instituições, não são MIT como o código — redistribuídos para uso nominativo (identificar a instituição numa interface), com template de takedown no repositório para quem quiser remoção.

## Feedback que procuro

1. Casos de uso que o formato atual não cobre;
2. Logo errado ou faltando (tem template de issue para instituições apontarem a arte no domínio oficial);
3. Ideias para as ~640 sem logo.

Repositório: https://github.com/rzmt/logos-bancos-br
