# Métricas do logos-bancos-br

Branch só de dados. O workflow `metricas.yml` da `main` grava aqui, toda
segunda, o que a API do GitHub só guarda por 14 dias. Não edite à mão.

- `diario.csv`: visitas e clones por dia (data em UTC). `visitantes` e
  `clonadores` contam pessoas únicas no dia.
- `origens.csv`: de onde vieram as visitas (Google, github.com,
  tabnews.com.br...). Cada coleta (`data`) cobre os 14 dias anteriores, então
  coletas seguidas se sobrepõem: compare uma coleta com outra, não some.
- `paginas.csv`: as páginas do repositório mais vistas, no mesmo formato.
- `estrelas.csv`: estrelas, forks e observadores no dia da coleta.
