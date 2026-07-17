<!-- Onde postar: LinkedIn (post pessoal). Copiar do primeiro parágrafo para baixo. -->

Publiquei um projeto open source que resolve um problema recorrente em apps financeiros no Brasil: exibir o nome e o logo da instituição do outro lado de um Pix ou TED — sem manter lista nenhuma manualmente.

O logos-bancos-br deriva tudo de três fontes públicas e oficiais: as listas de participantes do STR e do Pix, ambas do Banco Central, e o diretório de participantes do Open Finance Brasil, onde cada instituição publica o próprio logo. São 1.113 instituições (470 com código de banco + 643 só-Pix, em datasets separados) e 473 delas com logo — em apenas 160 arquivos, porque cooperativas afiliadas compartilham o asset do sistema em vez de ganhar cópia própria.

Duas decisões de que mais me orgulho:

— Logo errado é pior que logo nenhum: match automático só por identificador oficial (ISPB); semelhança de nome vira sugestão para revisão humana, nunca decisão.
— Proveniência por logo: o dataset registra a URI de origem, o SHA-256 e a data de cada arquivo. Um GitHub Action refaz tudo toda segunda e abre PR com o diff visual.

Funciona em qualquer stack: API TypeScript, mapa pronto para React Native, CLI que copia os assets para projetos Flutter/Kotlin/Swift, CDN e o JSON puro.

npm install logos-bancos-br
https://github.com/rzmt/logos-bancos-br

Feedback é muito bem-vindo — em especial de quem constrói produtos de pagamento.

#opensource #pix #openfinance #typescript
