# [RASCUNHO — LinkedIn]

Publiquei um projeto open source que resolve um problema chato de todo app financeiro brasileiro: **exibir a lista e os logos das instituições do Pix sem manter nada à mão**.

📦 logos-bancos-br → github.com/rzmt/logos-bancos-br

O diferencial não é o "o quê", é o "de onde":

🏦 **1.113 instituições** — união das listas oficiais de participantes do STR e do Pix, ambas do Banco Central
🎨 **473 logos** — do diretório de participantes do Open Finance Brasil (onde cada instituição publica a própria marca) e de sites oficiais curados
🔍 **Proveniência por logo** — URI de origem, SHA-256 e data no dataset; o diff do git é a auditoria
🤖 **Atualização semanal automática** — GitHub Action reconstrói tudo das fontes e abre PR com diff visual; nada entra sem revisão humana
🧩 **Qualquer stack** — API TypeScript, mapa React Native, CLI para copiar assets (Flutter, Kotlin, Swift...), CDN e JSON puro

Regra de ouro do projeto: em contexto bancário, logo errado é pior que logo nenhum. Match automático só por identificador oficial (ISPB); semelhança de nome vira sugestão para revisão humana, nunca decisão.

npm install logos-bancos-br

Feedback e contribuições são muito bem-vindos — especialmente de quem constrói apps de pagamento. 🙌

#opensource #pix #openfinance #fintech #typescript
