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

Variaveis utilizadas:

- `DB_TYPE`: tipo do banco, hoje `postgres`.
- `DB_HOST`: host do Postgres.
- `DB_PORT`: porta do Postgres.
- `DB_USERNAME`: usuario do banco.
- `DB_PASSWORD`: senha do banco.
- `DB_NAME`: nome do banco.
- `REDIS_HOST`: host do Redis.
- `REDIS_PORT`: porta do Redis.
- `EXCHANGE_RATE_API_KEY`: chave da API de cambio.

### Opcao 1: tudo com Docker Compose

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Preencha `EXCHANGE_RATE_API_KEY` no `.env`.

3. Suba a stack:

```bash
docker compose up --build
```

4. A API ficara disponivel em:

```text
http://localhost:3000
```

Observacao: quando a aplicacao roda dentro do `docker compose`, o host do banco e do Redis e ajustado pelo proprio compose. Nesse modo, o Redis usa porta interna `6379`.

### Opcao 2: aplicacao local e infraestrutura no Docker

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Preencha `EXCHANGE_RATE_API_KEY`.

3. Se for rodar a aplicacao localmente e usar apenas Postgres/Redis do compose, ajuste no `.env`:

```env
REDIS_PORT=6380
```

Isso e necessario porque, nesse modo, o Redis do compose fica exposto na maquina host em `6380:6379`.

4. Suba apenas a infraestrutura:

```bash
docker compose up -d postgres redis
```

5. Instale as dependencias:

```bash
npm install
```

6. Rode a aplicacao:

```bash
npm run start:dev
```

7. A API ficara disponivel em:

```text
http://localhost:3000
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

`GET /queue/metrics`

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

## Limitacoes conhecidas

### Idempotencia e consistencia entre banco e fila

Estou ciente de que a solucao atual de idempotencia resolve bem a duplicidade concorrente no nivel da persistencia, mas ainda existe uma janela importante entre persistir o pedido e publicar o job na fila.

Hoje, se o pedido for salvo no banco e o `enqueue` falhar logo depois, o sistema pode ficar com um pedido persistido em `RECEIVED` sem job correspondente em processamento.

Se eu fosse evoluir esse projeto, eu trataria esse ponto com Outbox Pattern:

1. persistir o pedido e um evento de saida na mesma transacao;
2. publicar o evento da outbox de forma assincrona e confiavel;
3. marcar o evento como entregue depois do envio para a fila.

Esse seria o caminho mais robusto para fechar a lacuna de consistencia entre banco e mensageria.

