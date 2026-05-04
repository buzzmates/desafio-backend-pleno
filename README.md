# Order Orchestrator

API em NestJS para recebimento de pedidos via webhook, persistencia em Postgres, processamento assincrono com BullMQ/Redis, enriquecimento via servico externo e administracao basica da fila.

Este projeto foi desenvolvido como resposta ao desafio tecnico de orquestracao de pedidos. A implementacao prioriza clareza do fluxo principal, testes automatizados no core e uma separacao inicial de camadas inspirada em Clean Architecture.

## O que foi implementado

- `POST /webhooks/orders` para receber, validar, persistir e enfileirar pedidos.
- Idempotencia baseada em `idempotency_key` com protecao por unicidade no banco e criacao controlada no repositorio.
- Processamento assincrono com BullMQ.
- Enriquecimento de pedido via API externa de cambio.
- Retry com backoff exponencial na fila principal.
- Envio para DLQ quando todas as tentativas falham.
- `GET /orders` com filtro opcional por status.
- `GET /orders/:id` com detalhes do pedido.
- `GET /queue/metrics` para visibilidade basica da fila.
- `POST /queue/retry-dlq` para reenfileirar jobs da DLQ manualmente.
- Testes unitarios, de controller, de repositorio, de processor e e2e de validacao HTTP.
- CI com lint, build, testes e validacao do Dockerfile via GitHub Actions.

## Arquitetura

O projeto busca separar responsabilidades em quatro camadas:

- `domain`: entidades, enums, erros e contratos.
- `application`: casos de uso e orquestracao de regras.
- `infrastructure`: TypeORM, BullMQ, integracao externa e implementacoes concretas.
- `presentation`: controllers HTTP e DTOs.

Estrutura simplificada:

```text
src/modules/orders
├── application
├── domain
├── infrastructure
└── presentation
```

Busquei seguir principios de Clean Architecture, mas nao considero a implementacao como uma Clean Architecture pura. Pelo tempo disponivel do desafio, optei por uma abordagem pragmatica: a separacao de camadas existe, mas ainda ha acoplamentos que eu refinaria em uma evolucao futura.

Exemplos de pontos que eu melhoraria:

- mover parte do mapeamento de resposta HTTP para a camada de apresentacao;
- transformar a administracao da fila em casos de uso dedicados na camada de application;
- reduzir o conhecimento de detalhes de infraestrutura fora dos adapters concretos.

## Como rodar

### Pre-requisitos

- Node.js 22
- npm
- Docker e Docker Compose
- chave valida para a API de cambio utilizada no enriquecimento

## Variaveis de ambiente

Este repositorio inclui um `.env.example` com os campos esperados.

Para subir tudo com Docker, na pratica o que voce precisa preencher e:

- `EXCHANGE_RATE_API_KEY`: chave da API de cambio.

No `docker compose`, as portas ficam fixas assim:

- API em `3000`
- Postgres em `5433`
- Redis em `6380`
- Prometheus em `9090`
- Grafana em `3001`

## Como rodar

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Preencha `EXCHANGE_RATE_API_KEY` no `.env`.

3. Suba a stack:

```bash
docker compose up --build
```

Se voce estiver rodando o backend localmente na porta `3000`, suba apenas a infraestrutura e a observabilidade:

```bash
docker compose up -d postgres redis prometheus grafana
```

4. A API ficara disponivel em:

```text
http://localhost:3000
```

5. Observabilidade:

```text
Prometheus: http://localhost:9090
Grafana: http://localhost:3001
```

Nesse modo, o Prometheus tambem tenta raspar o backend local em `localhost:3000`.

Login padrao do Grafana neste compose:

```text
usuario: admin
senha: admin
```

## Scripts uteis

```bash
npm run lint:check
npm run build
npm run test
npm run test:e2e
npm run start:dev
```

## Endpoints

### Receber pedido

`POST /webhooks/orders`

Exemplo de payload:

```json
{
	"order_id": "ext-123",
	"customer": {
		"email": "user@example.com",
		"name": "Ana"
	},
	"items": [
		{
			"sku": "ABC123",
			"qty": 2,
			"unit_price": 59.9
		}
	],
	"currency": "USD",
	"idempotency_key": "uuid-or-hash"
}
```

### Listar pedidos

`GET /orders`

Filtro opcional:

`GET /orders?status=RECEIVED`

Status atualmente usados no fluxo:

- `RECEIVED`
- `ENRICHED`
- `FAILED_ENRICHMENT`

### Buscar pedido por id

`GET /orders/:id`

### Metricas da fila

`GET /queue/metrics` --> foi pedido como requisito no teste tecnico, por isso eu fiz. Mas adicionei à aplicação o prometheus, para análise técnica mais detalhada.

### Metricas Prometheus

`GET /metrics`

### Reenfileirar DLQ

`POST /queue/retry-dlq`

## Testes

Os testes implementados cobrem o nucleo do fluxo:

- `OrderService`
- `EnrichmentService`
- `OrdersController`
- `WebhookController`
- `TypeOrmOrderRepository`
- `OrderProcessor`
- `ExchangeRateService`
- validacoes HTTP em e2e para payload e status invalidos

Comandos:

```bash
npm run test
npm run test:e2e
```

## CI

O workflow em `.github/workflows/ci.yml` executa:

- install (`npm ci`)
- lint (`npm run lint:check`)
- build (`npm run build`)
- testes unitarios/integracao (`npm run test`)
- testes e2e (`npm run test:e2e`)
- build da imagem Docker para validar o `Dockerfile`

## Observabilidade

O projeto expoe metricas em formato Prometheus no endpoint `GET /metrics`.

Ao subir o `docker compose`, os componentes abaixo ficam disponiveis:

- Prometheus em `http://localhost:9090`
- Grafana em `http://localhost:3001`

O Grafana ja sobe com o Prometheus provisionado como datasource padrao.

Consulta inicial recomendada no Grafana para ver volume de requests por rota nos ultimos 5 minutos:

```promql
sum by (route, method, status_code) (
	increase(http_requests_total{job="order-orchestrator-app-local"}[5m])
)
```

Outras queries uteis:

Latencia p95 por rota:

```promql
histogram_quantile(
	0.95,
	sum by (le, route, method) (
		rate(http_request_duration_seconds_bucket{job="order-orchestrator-app-local"}[5m])
	)
)
```

Jobs processados pela fila por resultado:

```promql
sum by (outcome) (
	increase(queue_jobs_processed_total{job="order-orchestrator-app-local"}[5m])
)
```

Chamadas externas por servico e resultado:

```promql
sum by (service, outcome) (
	increase(external_api_request_duration_seconds_count{job="order-orchestrator-app-local"}[5m])
)
```

Memoria residente do processo Node:

```promql
process_resident_memory_bytes{job="order-orchestrator-app-local"}
```

Se o backend estiver rodando em container pelo proprio `docker compose`, troque o job para `order-orchestrator-app-docker`.

Proximo passo natural de evolucao: adicionar testes de carga com k6 e integrar as metricas do proprio teste ao Grafana, para correlacionar o comportamento do sistema sob carga com as metricas da aplicacao, fila e integracao externa.

## Limitacoes conhecidas

### Idempotencia e consistencia entre banco e fila

Estou ciente de que a solucao atual de idempotencia resolve bem a duplicidade concorrente no nivel da persistencia, mas ainda existe uma janela importante entre persistir o pedido e publicar o job na fila.

Hoje, se o pedido for salvo no banco e o `enqueue` falhar logo depois, o sistema pode ficar com um pedido persistido em `RECEIVED` sem job correspondente em processamento.

Se eu fosse evoluir esse projeto, eu trataria esse ponto com Outbox Pattern:

1. persistir o pedido e um evento de saida na mesma transacao;
2. publicar o evento da outbox de forma assincrona e confiavel;
3. marcar o evento como entregue depois do envio para a fila.

Esse seria o caminho mais robusto para fechar a lacuna de consistencia entre banco e mensageria.

