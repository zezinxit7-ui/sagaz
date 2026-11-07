# Recon map: Tony (Android/iOS)

Escopo: o núcleo do Tony — assistente conversacional com IA que registra, numa
só conversa, finanças (pessoal e do negócio), lembretes/tarefas, hábitos e
metas, responde perguntas com número exato e age de forma proativa (plano do
dia, resumo semanal). Dieta por foto, diário e ideias ficam documentados mas
fora do escopo obrigatório do clone.
Para: aplicativo Android do próprio usuário, com identidade visual, nome,
código e recursos próprios (marca original nunca copiada).
Data: 2026-11-07

## Fontes

| # | fonte | URL | notas |
| --- | --- | --- | --- |
| 1 | Listagem Play Store | https://play.google.com/store/apps/details?id=ai.otony.tony | pitch, "how it works", módulos, planos, segurança de dados, 10K+ downloads, 30–33 avaliações |
| 2 | Site oficial | https://otony.ai | seções completas de recursos, planos (Stripe), FAQ, privacidade, prints reais das telas |
| 3 | 8 screenshots da Play Store | `replica/screens/sc01..sc08.png` | evidência visual das telas (ver inventário) |
| 4 | Termos de uso | https://otony.ai/termos | referenciados na listagem; não lidos nesta passada |
| 5 | Política de privacidade | https://otony.ai/privacidade | referenciada na listagem; não lida nesta passada |
| 6 | Listagem App Store | https://apps.apple.com/br/app/id6766030059 | citada no FAQ; não lida nesta passada |

Não foi usada nenhuma conta do usuário (nenhuma disponível). Nada foi lido
atrás de login, nenhum binário descompilado, nenhum endpoint interceptado.

## Core loop

O usuário conta o que aconteceu ou o que precisa acontecer — numa única
mensagem de texto ou voz ("gastei 30 no almoço e me lembra da luz amanhã") —
e o assistente extrai **todas** as ações da mensagem, registra cada item no
módulo certo (transação, lembrete, tarefa, hábito, dieta), **confirma item a
item na conversa** e depois responde perguntas com o número exato dos dados
reais ("quanto gastei?"). O usuário paga por falar e ser obedecido, sem
navegar entre telas de formulário.

## Telas

### Observadas (evidência direta: screenshots 1–8)

| ID | tela | rota / como se chega | propósito | componentes-chave | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Chat / home da conversa | tela inicial do app | registro e consulta por conversa; estado vazio saúda pelo nome | top bar (hambúrguer + wordmark + botão "..."), saudação "OLÁ, VICTOR / Como posso te ajudar?", barra de entrada com +, campo de texto, ícone de waveform e botão circular de microfone, disclaimer "IA e pode cometer erros" | vazio; cheio (feeds do site/print: mensagens, áudios, confirmações, fila offline "Sem conexão · 2 mensagens na fila") |
| S02 | Modo de voz em tempo real | botão de microfone do S01 | conversa por voz interrompível, com orbe animado central | orbe (gradiente azul/violeto animado), pill de status "RESPONDENDO 🗣", botão circular (X) para sair | ouvindo / respondendo |
| S03 | Gaveta de navegação (menu) | hambúrguer em S01/S04/S07 | navegação por módulos + conta | header de perfil (foto, nome, "Minha conta >"), item "Falar com Tony", seções "PRODUTIVIDADE" (Lembretes, Hábitos) e "VIDA" (Finanças, Dieta, Diário, Ideias), linha selecionada destacada | aberta sobre tela com cartões e mini-calendário |
| S04 | Lembretes — aba única + calendário | gaveta → Lembretes | central de lembretes/tarefas com métricas e calendário | top bar (hambúrguer + título "Lembretes"), segmentação "Lembretes / Recorrentes", 4 cartões de contagem (Pendentes 12 azul, Atrasadas 4 vermelho, Hoje 5 escuro, Concluídas 5 verde), seletor de visão (calendário/lista/kanban), navegador de mês "< Maio 2026 >", grade mensal D S T Q Q S S com pontos de eventos e hoje circulando, FAB + | com dados; bloco de visões distintas |
| S05 | Lembretes — aba Recorrentes | S04 → segmento "Recorrentes" | lista de rotinas com recorrência visível | cartões: título + horário + fundição ("Todo dia", "sab", "seg, qua, sex"), linha de chips de dias da semana S T Q Q S S D com dias ativos em azul, FAB + | cheio |
| S06 | Dieta — registro de refeição | menu "Dieta" (e via chat) | mostra a foto da refeição com nutrição estimada | foto do prato, etiqueta "🌙 Jantar", número grande de kcal (950, violeto), linha de macros: Proteína 45g (azul) · Carboidratos 95g (amarelo) · Gordura 43g (vermelho), rodapé "— Tony — 4 de mai. · 01:02" (atribuição da IA + data) | preenchida (foto) |
| S07 | Finanças — dashboard pessoal | gaveta → Finanças | visão geral do caixa pessoal | top bar (hambúrguer + "Finanças" + olho de privacidade), saldo grande "R$ 9.226,12 / Saldo Disponível", 4 botões circulares (Receita +, Despesa −, Relatório, Insights), cartões-contexto "Meu Negócio" (violeta) e "Assinaturas" (âmbar, "Gastos recorrentes"), seletor de mês "< Maio 2026 >", chips Resumo (Receitas verde, Despesas vermelho, Balanço), título "Transações Recentes" + chips Tudo/Receitas/Despesas, lista agrupada HOJE/ONTEM (ícone da categoria, título, categoria) | preenchida; esquema de cor navy (diferente do preto do chat) |
| S08 | Finanças — dashboard do negócio | S07 → cartão "Meu Negócio" (seta de retorno a leste) | mesmo padrão para o caixa da empresa | seta ← + título "Meu Negócio" + olho, "R$ 16.730,00 / Saldo Empresarial", mesmos 4 botões circulares, cartões-contexto "Pessoa Física / Finanças pessoais" (azul), "Assinaturas" (âmbar), "Me…(t)as/Objetivos" (verde, bandeira — parcialmente fora do quadro), resumo do mês, transações (ex.: "Almoço com cliente · Reuniões − R$ 240,00 · 02 mai."; "+ R$ 1.200,00") | preenchida |

### Mencionadas nas fontes, mas NÃO observadas (não reproduzidas por suposição — só como Inferidas)

Módulos confirmados pelas fontes de texto (Play + site), sem screenshot do
corpo da tela: tela/lista de Hábitos (com sequência de dias, letras da
semana e calendário do mês), tela de Assinaturas (total do mês, próxima
cobrança, alerta antes de vencer), tela de Relatórios, tela de Insights,
Metas de economia (progresso em anel + prazo), visão Kanban de tarefas,
tela/formulário de criação manual, tela de Diário, tela de Ideias,
onboarding/autenticação, conta/configurações, planos dentro do app.
Nenhum detalhe dessas telas foi extrapolado a partir do pouco visto.

## Fluxos

```
F01 Uma mensagem → vários registros (o fluxo central)
    S01 (mensagem de áudio/texto) → processamento → confirmações item a item na mesma conversa
    → valores já existentes nos módulos (S04, S07, S08)
    clicks felizes: 1 (enviar) — zero navegação
    borda: valor ambíguo (pedido de confirmação), dois contextos (pessoal/negócio)
    inferidos da mensagem, offline (fila de mensagens), foto anexada (dieta)
F02 Registrar despesa por conversa
    S01 → "gastei 30 no almoço" → extração (valor, categoria sugerida) → confirmação → salvo → dashboard atualizado
    borda: valor em variedade de formatos ("30", "R$ 30", "trinta reais"), categoria nova
F03 Registrar receita / receita do negócio
    S01 → mensagem com valor e contexto → salvo no contexto certo
    OU S07/S08 → botão Receita → formulário manual (não observado)
    borda: contexto do negócio inferido ("recebi 500 de um cliente" → negocial)
F04 Criar lembrete / tarefa
    S01 → "me lembra da conta de luz amanhã às 14h" → lembrete com data/hora
    OU S04 → FAB + → formulário (não observado) → item em contagem e calendário
    borda: recorrente ("todo dia", "seg, qua, sex"), hoje vs. atrasada
F05 Hábito: registrar e consultar
    S01 → "bebi 2 litros de água" → contagem do dia; pergunta "quantas vezes treinei?"
    → resposta com número exato ("12 de 30 dias. Sequência atual: 5")
    borda: meta numérica, dias da semana, sequência quebrada
F06 Dieta por foto (fora do escopo obrigatório)
    S01 → foto do prato → S06 com kcal + macros → correção por mensagem
    borda: identificação de alimentos, múltiplos itens no prato
F07 Resumo semanal (proativo)
    domingos, assistente inicia: tudo que aconteceu na semana (receitas,
    despesas, saldo) na conversa
    borda: semana vazia
F08 Perguntar sobre os próprios dados
    S01 → pergunta natural → resposta com número exato e fonte nos dados
    borda: sem dado → responde que não sabe (nunca inventar)
F09 Assinaturas / gastos recorrentes
    registro em conversa OU módulo próprio → total do mês, próxima cobrança,
    alerta antes de renovar
F10 Sessão de voz em tempo real
    S01 → microfone → S02 (orbe) → ações executadas falando → voltar ao chat
    borda: interrupção, memória compartilhada com o chat
F11 Privacidade de saldo
    S07/S08 → botão olho → valores mascarados
```

## Componentes

| componente | variantes | estados | usado em |
| --- | --- | --- | --- |
| Top bar | chat (hambúrguer+wordmark+"..."), módulo (hambúrguer+título), submódulo (← + título), com ícone de privacidade | default | S01, S04, S06, S07, S08 |
| Gaveta de navegação | com seções rotuladas, header de perfil, linha selecionada | aberta/fechada | S03 sobre todas |
| Barra de entrada de chat | com +, waveform, mic | vazia, preenchida, offline (fila), enviando | S01 |
| Mensagem de confirmação de ação | cartão no fio (decisão da estrutura final) | sugerida→confirmada | S01 |
| Pill de status | "RESPONDENDO", fila offline | ativa | S01, S02 |
| Cartão de contagem | azul/vermelho/escuro/verde com ícone e número grande | default | S04 |
| Segmentação de abas | 2 abas (Lembretes/Recorrentes) | selecionada | S04, S05 |
| Seletor de visão | 3 ícones (calendário/lista/kanban) | selecionado | S04 |
| Navegador de mês | setas + rótulo "Maio 2026" | default | S04, S07, S08 |
| Grade mensal | dias com pontos de evento, hoje destacado | default | S04 |
| Chips de dias da semana | S T Q Q S S D, dias ativos | selecionado/múltiplo | S05 |
| FAB | "+" azul circular | default | S04, S05 |
| Botão de ação circular | Receita +, Despesa −, Relatório, Insights (com rótulo) | default | S07, S08 |
| Cartão-contexto | gradiente por módulo (Meu Negócio, Assinaturas, Pessoa Física, Metas) | default | S07, S08 |
| Chips de filtro | Tudo/Receitas/Despesas | selecionado | S07, S08 |
| Lista de transações | agrupada por dia (HOJE/ONTEM), linha: ícone, título, categoria, valor colorido, data | preenchida | S07, S08 |
| Bloco de macros | kcal grande + 3 valores coloridos sobre a foto | default | S06 |
| Orbe de voz | gradiente animado | ouvindo/falando/respondendo | S02 |
| Toggle de privacidade | olho (mascarar valores) | ativo/inativo | S07, S08 |
| Disclaimer de IA | linha discreta no rodapé | fixo | S01 |
| Saudação personalizada | eyebrow caps "OLÁ, VICTOR" + pergunta | nome do perfil | S01 |

Nota de identidade visual: tema preto/grafite no chat e produtivo; a seção de
finanças usa surface navy distinta; acentos vivos (azul mic/FAB, verde/vermelho
de valores, violeto de kcal) sobre dark; tipografia forte em números grandes.
Referência de experiência apenas — novo sistema de design será dado.

## Modelo de dados inferido

```
User        id, name, avatar, nickname(memo), auth_provider, created_at
            evidence: S03 perfil; página "Me chama de Vitão"
            confidence: guess (tela de conta não observada)
Context     id, user_id, kind (personal | business), name ("Pessoa Física", "Meu Negócio")
            evidence: S07 "Meu Negócio", S08 "Pessoa Física", site "pessoal e negócio separados"
            confidence: high
Conversation id, user_id, started_at, title?
Message     id, conversation_id, role (user | assistant), kind (text | audio | photo | action_card),
            body, audio_duration?, media_ref?, status (sent | queued_offline | failed), created_at
            evidence: S01, site "áudios", fila offline "2 mensagens na fila"
            confidence: high
Action      id, message_id, kind (expense | income | reminder | task | habit_log | diet_entry | summary…),
            target_entity_id, payload (json), status (proposed | confirmed | rejected | applied)
            evidence: "registra cada item no lugar certo e confirma o que você fez";
            "uma mensagem pode disparar várias ações"
            confidence: high (semântica), guess (payload)
Transaction id, context_id, type (income | expense), amount_cents, category_id,
            date, title, note?, source (chat | manual), created_at
            evidence: S07/S08 linhas, chips filtro, site "lançado, categorizado e somado"
            confidence: high
Category    id, context_id?, name, icon, kind (income | expense), is_default, custom?
            evidence: S07 ("Saúde" + ícone coração), "categorias"
            confidence: medium
Subscription id, context_id, merchant, amount_cents, recurrence (monthly), next_charge_at,
             alert_before (bool)
            evidence: card "Assinaturas — Gastos recorrentes", site (total do mês, próxima cobrança, alerta)
            confidence: medium
Goal        id, context_id?, kind (savings | personal), name, target_amount_cents?, deadline?,
            saved_amount_cents?, steps? (json), progress
            evidence: "Metas de economia… progresso atualizado, com anel de atividade e prazo";
            cartão verde de metas em S08
            confidence: medium
Reminder    id, title, due_at, recurrence (none | daily | weekly | monthly | weekdays),
            weekdays? (set), status (pending | late | done), source
            evidence: S04 (Pendentes/Atrasadas/Hoje/Concluídas), S05 (chips de dias, "Todo dia"),
            site (diária, semanal, mensal)
            confidence: high
Task        id, title, deadline?, priority, stage? (para kanban), status (open | done)
            evidence: Play "prioridade e prazo; lista, kanban ou calendário"; seletor de visão S04
            confidence: high (existência), medium (campos)
Habit       id, name, weekdays? (set), target_value? (meta numérica), unit?
HabitLog    id, habit_id, date, value
            evidence: "23 dias seguidos", "STQQSSD", "12 de 30 dias. Sequência atual: 5",
            "bebi 2 litros de água", calendário mensal
            confidence: high (motor), medium (campos exatos)
DietEntry   id, date, meal_type (café | almoço | jantar…), image_ref?, kcal, protein_g, carbs_g, fat_g,
            estimated_by (ai | manual), corrected?
            evidence: S06, site "foto vira registro", "corrige por mensagem"
            confidence: high (campos vistos)
JournalEntry id, date, body            evidence: item "Diário" do menu   confidence: guess (tela não vista)
Idea        id, body, created_at     evidence: item "Ideias" do menu   confidence: guess
Memory      id, user_id, kind (preference | fact), content, active,forgotten_at?
            evidence: "ele lembra de você… se pedir pra esquecer, ele esquece"
            confidence: high (semântica)
Summary     id, kind (weekly | morning | review), period, generated_at, delivered_in_conversation
            evidence: "começa o dia com o plano… resumo da semana no domingo"
            confidence: medium
```

Relações: User 1‑n Context; User 1‑n Conversation, Conversation 1‑n Message,
Message 1‑n Action; Context 1‑n Transaction/Subscription/Goal; Reminder e
Task podem ser globais ao usuário (não observado vínculo com contexto);
Habit 1‑n HabitLog; DietEntry independente; Memory e Summary pendem de User.

## Matriz de funcionalidades

Veja `features.csv`. Resumo: must 30, should 17, could 8, skip 4.

## Fora de escopo (não clonável / não deve ser clonado)

- Integração com o Gemini e a engenharia de prompt do Tony (usaremos a API
  escolhida pelo usuário, configurada por variáveis de ambiente).
- Assinaturas com billing do Google Play/Stripe do Tony: o clone terá
  monetização própria (fora da primeira fase).
- Marca "Tony", wordmark, "Vitão", logo, textos e fingerprint visual do
  original: identidade nova obrigatória (fase de branding).
- Auditoria de segurança e certificações do Tony.
- A base de usuários e a rede do Tony.
- Conexão com banco: o Tony explicitamente NÃO conecta ao banco nem pagamentos
  ("você conta o que aconteceu") — o clone segue o mesmo desenho por decisão.

## Tamanho

Telas observadas: 8 (+~10 módulos/telas citados e não observados).
Fluxos: 11. Entidades: 15. Partes difíceis:
1) extração de linguagem natural em PT-BR com intenções múltiplas por
   mensagem e confirmação item a item;
2) conversa por voz em tempo real (interrompível) — a parte mais pesada;
3) modo offline com fila de mensagens + proatividade (notificações agendadas);
4) dual ledger (pessoal/negócio) atravessando todo o domínio financeiro;
5) dieta multimodal por foto (exige modelo multimodal).

Tamanho: **L** como "todo o Tony"; **M** para um núcleo bem cortado
(conversa → finança + lembretes/tarefas + hábitos + metas, dashboard,
resumos, IA por API do usuário), que é o recorte do escopo dado.
