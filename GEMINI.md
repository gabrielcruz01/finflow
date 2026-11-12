# Diretrizes do Projeto: Painel de Controle Financeiro Pessoal

## 1. Stack e Arquitetura
- SPA Client-Side pura: HTML5 + Tailwind CSS (CDN) + Vanilla JS (ES6+).
- Suporte PWA Offline: `manifest.json` + `sw.js` (Service Worker com estratégia de Stale-While-Revalidate).
- Persistência primária: `localStorage` (`@finance:state_v1`).
- Suporte a Backup: Download/Upload de snapshot JSON local.
- Relatórios: Exportação de fechamento mensal em CSV formatado (`\uFEFF` UTF-8 com separador `;` para Excel).

## 2. Padrões de Código
- Moeda: Formatação estrita em Real brasileiro (`R$ 0,00`) usando `Intl.NumberFormat`.
- Entradas Numéricas: Máscara inteligente nos inputs (deslocamento de centavos estilo caixa eletrônico).
- Datas: Formato ISO para armazenamento (`YYYY-MM-DD` / UTC); exibição localizada em `DD/MM/AAAA`.
- Manipulação DOM: Modular, sem frameworks pesados, mantendo re-renderizações isoladas por componente.
- Toasts & Modais: Totalmente customizados em Tailwind/Vanilla (sem dependência de `alert()` ou `confirm()` nativos).

## 3. Backlog Técnico & Evoluções
- [x] Implementação de Service Worker para suporte PWA offline completo.
- [x] Recorrência de contas fixas ao virar o mês (detecção automática + replicação com 1 clique).
- [x] Exportação de fechamento mensal em CSV formatado (`\uFEFF` UTF-8).
- [x] Edição in-place de contas fixas e lançamentos diários.
- [x] Máscara de entrada monetária em tempo real nos formulários.
- [x] Orçamento por categoria com alerta visual de teto de gastos (Budgeting).
- [x] Projeção de ritmo de queima orçamentária (Burn-rate diário).
