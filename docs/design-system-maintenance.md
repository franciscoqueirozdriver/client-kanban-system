# Guia rápido de manutenção de UI

Este projeto utiliza o design system violeta com suporte a tema claro/escuro baseado em variáveis CSS declaradas em `app/globals.css`. A seguir, as diretrizes essenciais para evoluir a interface mantendo consistência, acessibilidade e responsividade.

## Tokens de cores

- **Fundos**: `bg-background`, `bg-card`, `bg-muted`.
- **Textos**: `text-foreground`, `text-muted-foreground`, `text-primary-foreground`.
- **Acentos**: `bg-primary`, `bg-secondary`, `bg-accent`.
- **Estados**: `bg-success`, `bg-warning`, `bg-danger` para comunicar status.
- Utilize sempre classes Tailwind conectadas a tokens (`hsl(var(--token))`). Evite hexadecimais diretos.

## Componentes compartilhados

- **Cards** (`components/SummaryCard.jsx`): usam `rounded-3xl`, `shadow-soft` e gradiente suave. Ao criar novos cards, mantenha padding `p-6` e tipografia `text-sm` para cabeçalhos.
- **Tabelas** (`components/leads-table/LeadsTable.tsx`): cabeçalho colante, zebra com `hover:bg-muted/40`, foco visível em inputs/botões. Novas colunas devem respeitar `px-4 py-3`.
- **Kanban**: colunas em `components/KanbanColumn.jsx` e cards em `components/KanbanCard.jsx`. Use `rounded-3xl` para colunas e `rounded-2xl` para cards, sempre com `focus-visible:ring-primary`.
- **Sidebar** (`components/Sidebar.jsx`): ícones lucide-react, toggle de tema com `next-themes`. Para novos links, acrescente ao array `NAV_ITEMS`.

## Tema e dark mode

- O `ThemeProvider` de `next-themes` aplica a classe `.dark`. Qualquer novo componente deve ler cores via tokens.
- Para estados dinâmicos, defina variáveis CSS locais (ex.: `style={{ '--card-accent': ... }}`) e aplique em classe.

## Acessibilidade

- Interativos utilizam `focus-visible:ring-2 focus-visible:ring-primary`.
- Inclua `aria-label`/`aria-checked` em toggles (`ViewToggle` segue como referência).
- Drag-and-drop mantém `aria-live="polite"` nas colunas.

## Responsividade

- Layout principal: `Sidebar` fixa em desktop (`md:pl-72`) e off-canvas no mobile.
- Grade de cards: `sm:grid-cols-2`, `xl:grid-cols-4`.
- Tabelas usam `min-w-[960px]` + contêiner com `overflow-auto`.

## Build de gráficos

- `components/Charts.jsx` usa Recharts com paleta via CSS variables. Ao adicionar novas séries, utilize `fill="hsl(var(--token))"`.

Manter estes padrões garante continuidade visual e reduz retrabalho quando temas/tokens forem atualizados.
