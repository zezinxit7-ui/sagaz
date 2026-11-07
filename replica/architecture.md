# Arquitetura — Sagaz (assistente financeiro com IA)

**Produto:** Sagaz — organização por conversa, com dados no próprio dispositivo.
**Escopo da v1:** Android (via wrapper web), offline-first, IA por API do
usuário (variáveis de ambiente/configuração), sem backend próprio.
Base: `replica/recon.md` + `replica/features.csv` (30 must / 17 should / 8 could / 4 skip).

## 1. Stack e por quê

| camada | escolha | por quê |
| --- | --- | --- |
| app web | React 18 + TypeScript (strict) | DOM maduro, tipagem forte, testes com jsdom |
| build/rótulos | Vite + dev server | build rápido, PWA-ready |
| estilo | Tailwind 4 + tokens (`styles.css`) | consistência; tokens vêm de `replica-design` |
| banco | **Dexie 4 (IndexedDB)** | persistência real no dispositivo, migrações versionadas, funciona offline |
| Android | **Capacitor 8** + LocalNotifications + SplashScreen | APK real do mesmo código; notch/splash/permissões |
| gráficos | Recharts | linha/barras/donut para finanças |
| ícones | Lucide React | leve, consistente |
| testes | Vitest + Testing Library + fake-indexeddb | domínio e telas testáveis sem navegador |
| IA | **adaptador OpenAI-compatible** (fetch) | funciona com OpenAI, Gemini (endpoint compatível), Groq, OpenRouter, LLM local em rede — o usuário fornece base URL + chave + modelo |

**Decisões chave:**
- **Sem backend no v1.** Dados pessoais ficam no dispositivo (mesma filosofia de
  "seus dados, suas regras", mas local-first). Autenticação = perfil local +
  bloqueio de app (PIN) implementado **de verdade**; sincronização em nuvem
  fica documentada como evolução (Supabase) sem inventar credenciais.
- **IA com contrato estrito.** O LLM só devolve **propostas de ação em JSON**;
  nada é escrito no banco sem confirmação do usuário. A IA nunca alega ter
  feito algo: a confirmação vem do sistema.
- **Chave de API** configurável por ambiente (`VITE_AI_*`) ou na tela de
  Configurações (armazenada no banco local, nunca em log). Sem chave, o app
  continua 100% funcional (modo local com extração de intenções básica).

## 2. Estrutura de diretórios

```
src/
  app/                # bootstrap, roteador por estado, AppShell
  components/         # primitivas compartilhadas (TopBar, Drawer, FAB, Card…)
  data/               # Dexie: schema+migrações (db.ts), repositórios por domínio
  domain/             # dinheiro (centavos), datas, recorrência, streaks, summaries
  services/ai/        # client LLM, extração de ações, executor, respostas, memória
  features/
    chat/             # S01 chat + fila offline + confirmações
    finance/          # S07/S08 dashboard dual-ledger + transações + orçamento + relatório
    productivity/     # S04/S05 lembretes + calendário + hábitos + metas
    goals/            # metas de economia e pessoais
    settings/         # conta local, IA, backup, bloqueio
  styles.css          # design system (tokens das superfícies/tipografia)
```

## 3. Esquema do banco (Dexie v1 — `src/data/db.ts`)

Padrões: dinheiro em **centavos inteiros** (`amountCents`, moeda BRL fixa);
datas por dia local (`YYYY-MM-DD`) + timestamps ISO/UTC para eventos de tempo;
enums validados na camada de domínio (Dexie não aplica CHECK); toda linha
de usuário pertence ao perfil local atual (multi-perfil futuro).

| tabela | campos principais | índices |
| --- | --- | --- |
| `contexts` | id, kind (`personal`\|`business`), name, color | `kind` |
| `categories` | id, contextId?, name, icon, kind (income\|expense), scope (`default`\|`custom`) | `[contextId+kind]`, `name` |
| `transactions` | id, contextId, type (income\|expense), amountCents, categoryId, date (`YYYY-MM-DD`), note?, source (`chat`\|`manual`), actionId?, createdAt | `[contextId+date]`, `[categoryId]` |
| `budgets` | id, contextId, month (`YYYY-MM`), totalCents, perCategoryCents (dict) | `[contextId+month]` único |
| `subscriptions` | id, contextId, name, amountCents, cycle (`monthly`\|`yearly`), nextChargeDate, remindBeforeDays | `[contextId+nextChargeDate]` |
| `goals` | id, contextId?, kind (`savings`\|`personal`), name, targetCents?, deadline?, savedCents, steps[] | `kind` |
| `goalSteps` | id, goalId, title, done | `[goalId]` |
| `reminders` | id, title, dueAt?, kind (`once`\|`recurring`), recurrence (`daily`\|`weekly`\|`monthly`), weekdays[] (0–6), status (`pending`\|`done`), doneAt?, actionId? (idempotência) | `[status]`, `[kind]`, índice por data |
| `habits` | id, name, weekdays[] , targetValue?, unit? | |
| `habitLogs` | id, [habitId+date] único, valueCents?/value | `[habitId+date]` único |
| `conversations` | id, title?, startedAt | `startedAt` |
| `messages` | id, conversationId, role (`user`\|`assistant`), kind (`text`\|`action_card`\|`summary`), body, status (`sent`\|`queued`\|`failed`), actions?, createdAt | `[conversationId+createdAt]` |
| `memories` | id, content, active, createdAt | `active` |
| `profiles` | id único, name, nickname, pinHash, theme, aiConfig (baseUrl, model, key) | — |

**Regras que "mordem"** (resolvidas no domínio, não na UI):
- **Idempotência do chat:** cada ação proposta carrega `actionId` único; o
  executor recusa aplicar duas vezes (índice/verificação).
- **Fuso horário:** dias são armazenados como data local do dispositivo
  (`YYYY-MM-DD`); consultas mensais ignoram UTC; resumo usa o mesmo corte.
- **Recorrência:** gerador puro (`domain/recurrence.ts`) — expansão diária,
  semanal (conjunto de dias) e mensal (clamp p/ meses curtos) — base dos
  lembretes recorrentes e do calendário.
- **Offline:** mensagens com status `queued` tentam reenviar ao abrir o app;
  confirmações nunca dependem de rede para serem aplicadas.

## 4. "API" do app (frontiers internas)

Sem REST: contratos de função entre camadas. As únicas chamadas de rede são
para o LLM:

| função (serviço) | entrada | saída | usada em |
| --- | --- | --- | --- |
| `aiClient.complete(messages)` | mensagens | texto/JSON | chat, resumos, perguntas |
| `actionExtractor.parse(textOrSpeech)` | mensagem do usuário | `ActionProposal[]` (amount/date/genre/context/title) | chat |
| `actionExecutor.apply(proposals, confirmations)` | propostas + decisões | escritas no Dexie (idempotente por actionId) | chat |
| `summarizer.weekly(contextId)` | período | texto do resumo + números reais | resumo semanal |
| `qa.answer(question)` | pergunta | resposta com dados consultados | chat |

**Contrato IA:** resposta do modelo deve ser JSON válido com
`{action: "expense"|"income"|"reminder"|"task"|"habit_log"|"question_answer", ...}`
— validado por schema interno antes de virar proposta; inválido → o app pede
reformulação (nunca aplica nada); sem chave configurada → fallback local
(regex de valor/datas/categorias) claramente rotulado.

## 5. Segurança

- Chave de IA nunca em log; requisição só a base URL configurada.
- Bloqueio do app por PIN (hash, não texto puro); backup exportável é
  responsabilidade do usuário (aviso na tela).
- Android: permissões mínimas (RECORD_AUDIO opcional para voz; POST_NOTIFICATIONS).

## 6. Ordem de construção (slice vertical primeiro)

1. **Slice vertical:** mensagem → proposta de despesa → confirmação → Dexie →
   dashboard atualiza (chat + finança mínimos) *(prova da stack)*.
2. **Finance:** cadastro manual, categorias, filtros, mês, gráficos, orçamento,
   assinaturas, relatório *(S07/S08, musts)*.
3. **Produtividade:** lembretes + recorrência + calendário + métricas, hábitos
   com streak, metas com etapas *(S04/S05, musts)*.
4. **IA ampla:** perguntas com dados reais, memória, resumo semanal, fila offline.
5. **Should/could:** bloqueio, backup, voice STT no chat, notificações.
6. **Kanban, voz full-duplex, dieta, insights:** fases depois (could).

Riscos maiores: (1) confiabilidade da extração em pt-BR; (2) fuso/datas
mistas; (3) proatividade sem backend (notificações locais)`);
