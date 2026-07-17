# Segurança / Security

## Reportando vulnerabilidades

Encontrou uma vulnerabilidade (ex.: SVG malicioso que passou pela sanitização, problema no
pipeline de download, dependência comprometida)? **Não abra uma issue pública com os detalhes.**
Use o canal privado do GitHub: aba **Security → Report a vulnerability** neste repositório
(GitHub Private Vulnerability Reporting). Respondo o quanto antes e credito a descoberta, se
desejar.

*Found a vulnerability? Please do not open a public issue with the details — use GitHub's
private vulnerability reporting (Security tab → Report a vulnerability).*

## Medidas existentes

- **Downloads**: apenas `https`, com timeout, teto de 2 MB por arquivo e limite de 100 MP por
  imagem (anti decompression bomb).
- **SVGs** só são redistribuídos após sanitização conservadora: rejeitados se contêm `script`,
  event handlers (`on*=`), `javascript:`, `foreignObject` ou referências externas
  (`href`/`src`/`url()` para outros hosts). Reprovado na sanitização → distribui-se apenas o PNG
  rasterizado.
- **Proveniência**: cada logo registra URI de origem, SHA-256 do arquivo original e data em
  `data/bancos.json`; o histórico do git é a trilha de auditoria.
- **Publicação**: npm com `--provenance` (build rastreável ao commit e à execução do GitHub
  Actions). Verifique com `npm audit signatures`.
- **Runtime**: o pacote não tem dependências de runtime e não faz rede — todos os dados e
  imagens são estáticos.
