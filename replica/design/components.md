# Componentes — Sagaz

Base: recon (S01–S08) + tokens.json. Primitivas construídas uma vez em
`src/components/`, consomem apenas papéis dos tokens (`bg-surface`,
`text-muted` etc. — nunca hex solto).

```
TopBar
  variantes  chat (menu + wordmark + próximo), módulo (menu + título), submódulo (voltar + título)
  ações      direita opcionais (ex.: olho de privacidade)
  estados    default; título central fixo; 56px, sticky
  usados em  todas as telas

Drawer (navegação)
  conteúdo   header de perfil (avatar/iniciais, nome, botão Conta >),
             item Falar com Sagaz, seções PRODUTIVIDADE (Lembretes, Hábitos)
             e VIDA (Finanças, Metas), rodapé (Configurações)
  estados    aberta/fechada, linha selecionada, backdrop scrim
  usados em  todo o app

ChatInput
  anatomia   botão + (anexo), campo texto, botão mic (STT quando suportado), enviar
  estados    vazio, digitando, enviando (spinner), para offline (fila local), erro
  acessível  label própria, área alvo ≥44px, rodapé com disclaimer de IA
  usados em  S01, tela de chat

MessageBubble
  variantes  usuário (accent sutil), assistente (surface), card de ação (surface-2 + borda)
  estados    enviada, na fila, falha (botão reenviar), card de confirmação:
             proposta listada COM botões Descartar/Confirmar e badge de status
             pendente/aplicada/descartada
  usados em  chat

ActionProposalCard
  conteúdo   tipo (despesa/receita/lembrete/hábito), valor formatado, data,
             categoria sugerida (editável), botões Confirmar/Descartar
  estados    pendente, confirmada/salva, descartada, erro de validação
  regra      NENHUMA escrita no banco sem Confirmar; idempotente por actionId
  usados em  chat

StatCard
  variantes  azul/vermelho/neutro/verde com ícone + número grande
  estados    default; antes/después de clicar mantém tabela
  usados em  lembretes, dashboard

ViewSwitcher
  conteúdo   calendário/lista (kanban só na fase could — não exibido indisponível)
  estados    selecionado (accent)
  usados em  lembretes

MonthPager
  anatomia   chevrons + "Maio 2026"; limita navegação a meses com dados? (não limita)
  usados em  lembretes, finanças

WeekdayChips
  conteúdo   S T Q Q S S D; dias ativos = recorrência
  estados    inativo, ativo (accent), hoje (outline)
  usados em  lembretes recorrentes, hábitos

TransactionRow
  anatomia   ícone da categoria (cor por categoria), título, categoria,
             valor (+verde/−vermelho ou mascarado), data
  estados    normal, mascarado (privacidade), press câncipe de edição
  usados em  dashboard financeiro

FilterChips
  conteúdo   Tudo/Receitas/Despesas
  usados em  dashboard

CircularAction
  conteúdo   Receita/Despesa/Relatório — botão circular com rótulo
  estados    default, focus, loading
  usados em  dashboard financeiro

ContextCard
  conteúdo   célula com gradiente por contexto: Meu Negócio, Assinaturas,
             Pessoa Física, Metas
  usados em  dashboard financeiro

HabitCard
  conteúdo   nome, streak (dias seguidos), linha de dias da semana, botão Registrar hoje
  estados    concluído hoje (check), pendente, fora do dia do hábito
  usados em  hábitos

GoalCard
  conteúdo   nome, alvo, progresso (barra), prazo; etapas com checklist
  estados    em aberto, concluída, atrasada
  usados em  metas

FAB
  estados    default, expanded; abre formulários do módulo
  usados em  lembretes, finanças, metas

BottomSheet / Modal (formulários)
  uso        criação manual: transação, lembrete, hábito, meta
  estados    aberto, com erro de validação inline, bloqueio de scroll de fundo
  a11y       foco preso no modal, fecha com Esc/backdrop

EmptyState
  conteúdo   ícone, título e ação sugerida — todos escritos com voz própria
  estados    vazio por módulo (chat vazio, sem transações, sem lembretes…)
  usados em  todos

Spinner / ErrorState
  global     carregamentos llm (com cancelar), erro de rede com retry
```

Movimento: transições `180ms cubic-bezier(.2,.8,.2,1)`; entradas de listas
subindo 6px + fade; orbe não faz parte do v1 (voz em tempo real é could).
Tipografia: números grandes usam `display`/`xl` com `tabular-nums`.
