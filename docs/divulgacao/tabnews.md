# [RASCUNHO — TabNews / Pitch]

**Título:** Pitch: dataset + logos de todas as instituições do Pix (1.113), só com fontes oficiais do BCB e Open Finance — atualizado toda semana por CI

---

Todo app que mostra transferência, Pix ou boleto esbarra no mesmo problema: exibir o nome e o logo da instituição do outro lado. As opções que encontrei eram listas mantidas à mão (que envelhecem) ou logos coletados de sites aleatórios (sem rastreabilidade). Resolvi atacar o problema de outro jeito e o resultado é open source:

**[logos-bancos-br](https://github.com/rzmt/logos-bancos-br)** — `npm install logos-bancos-br`

## A ideia central: só fontes oficiais, com proveniência

- **A lista de instituições** é a união, por ISPB, de duas listas públicas do **Banco Central**: participantes do STR (as ~470 com código COMPE) e **participantes ativos do Pix** (CSV diário oficial — mais ~640 fintechs, IPs e cooperativas sem COMPE). Total: **1.113 instituições**, com atributos de participação no Pix.
- **Os logos** vêm do **diretório de participantes do Open Finance Brasil** — onde cada instituição publica e mantém a própria marca — e, para quem não participa, do **site oficial da própria instituição** (com curadoria visual). Afiliadas de sistemas cooperativos de marca única (Sicoob, Sicredi, Cresol, Unicred) recebem o logo do sistema por regra explícita. Hoje: **473 logos**.
- **Cada logo carrega proveniência**: URI de origem, SHA-256 do arquivo original e data, dentro do `data/bancos.json`. O diff do git é a auditoria.
- **Atualização automática**: um GitHub Action roda toda segunda, reconstrói lista + logos das fontes e abre um PR com o diff visual (o GitHub renderiza os PNGs). Nada entra sem revisão humana; match automático só por ISPB — semelhança de nome nunca atribui logo sozinha, porque logo errado em contexto bancário é pior que logo nenhum.

## Uso em qualquer stack

```ts
import { byCompe, byIspb, logoCdnUrl } from 'logos-bancos-br';
byCompe(341);       // Itaú — ispb, nomes oficiais, logo com proveniência
byIspb('11275560'); // RecargaPay — instituição só-Pix, sem COMPE
logoCdnUrl(260);    // URL do jsDelivr pinada na versão
```

- React Native: `import logos from 'logos-bancos-br/react-native'` (mapa `require()` pronto pro Metro)
- Flutter/Kotlin/Swift/etc.: `npx logos-bancos-br copy --dest ./assets/banks`
- Sem instalar nada: `https://cdn.jsdelivr.net/npm/logos-bancos-br@0.3.0/logos/png/60701190.png`
- Só o JSON: `logos-bancos-br/data/bancos.json`

## O que eu adoraria de feedback

1. Casos de uso que o formato atual não cobre bem;
2. Instituições com logo errado/faltando (tem template de issue — inclusive um de **remoção de marca** para as próprias instituições);
3. Ideias para a cobertura dos ~640 sem logo (SCDs e IPs pequenas que não publicam marca em lugar oficial nenhum).

Licença MIT para código e dataset; os logos são marcas das instituições, redistribuídos para uso nominativo (política de takedown no repo).
