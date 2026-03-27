# Poker Ranking

Um sistema web simples para organizar grupos de poker entre amigos, registrar partidas, acompanhar lucro/prejuízo e manter um ranking atualizado dos jogadores.

## Sobre o projeto

O **Poker Ranking** foi criado para resolver um problema bem específico de uso pessoal: acompanhar, de forma mais prática e visual, o saldo acumulado dos jogadores de um grupo de poker ao longo das partidas.

A ideia é substituir controles manuais em papel, mensagens ou planilhas por uma interface web simples, bonita e fácil de usar.

## Objetivo

Permitir que um grupo de amigos possa:

- criar um grupo privado
- entrar em uma partida
- registrar buy-in e cash-out
- acompanhar lucro e prejuízo de cada jogador
- visualizar o ranking geral do grupo
- consultar histórico de partidas
- administrar jogadores e configurações do grupo

## Stack utilizada

### Front-end
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

### Back-end / Infra
- [Supabase](https://supabase.com/)
  - PostgreSQL
  - RPCs
  - Views
  - Storage

## Estrutura geral

O projeto usa:

- **Next.js App Router** no front-end
- **Supabase** como backend
- **código curto de grupo** para acesso
- **sessão simples em localStorage**
- **fluxo leve**, voltado para uso privado

## Observação importante sobre segurança

Este projeto foi feito **para uso pessoal e entre amigos**, com foco em praticidade e diversão.

Ele **não foi desenvolvido com medidas de segurança rígidas como prioridade**. Algumas decisões foram tomadas para simplificar o desenvolvimento e facilitar o uso entre pessoas de confiança.

### Em outras palavras:
- este **não é** um sistema pronto para produção pública
- **não é recomendado** para uso comercial
- **não é recomendado** para uso com usuários desconhecidos
- **não segue todas as boas práticas de segurança de forma rigorosa**

A proposta aqui foi construir algo funcional e divertido para um grupo privado, e não um produto enterprise ou uma plataforma pública.

## Projeto vibecodado

Sim: este projeto foi fortemente **vibecodado**.

Isso significa que ele nasceu com uma abordagem mais experimental, rápida e iterativa, priorizando:
- ideia
- fluxo
- experiência
- diversão
- validação entre amigos

em vez de seguir, desde o começo, um processo rígido de engenharia de software voltado para alta robustez, escalabilidade ou segurança formal.

## Limitações atuais

Alguns pontos que ainda podem ser melhorados no futuro:

- controle de permissão mais robusto no backend
- sessão mais segura do lado do servidor
- proteção mais forte contra manipulação de dados no front
- regras administrativas validadas também no banco
- refinamentos de UX
- tratamento de erros mais refinado
- testes automatizados

## Possíveis evoluções futuras

- autenticação real por usuário
- permissões mais seguras com RLS mais refinado
- upload mais avançado de mídia
- página individual de jogador
- gráficos históricos
- relatórios/exportação
- melhorias visuais e responsivas
- auditoria de alterações
