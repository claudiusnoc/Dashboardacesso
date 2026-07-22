# Portal de Acessos Claro MG

O portal e uma aplicacao React/Vite preparada para operar exclusivamente no Supabase.

## Desenvolvimento local

1. Duplique `.env.example` como `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Execute `npm.cmd run dev`.
4. Acesse `http://127.0.0.1:5177`.

Sem as variaveis, o portal mostra somente a tela de conexao e nao grava dados localmente.

## Dados

Sites, casos, colaboradores, documentos e auditoria sao consultados diretamente no Supabase. O portal nao usa arquivos JSON locais como fonte de dados operacional.

## Colaboradores e documentos

- Fotografia da carga inicial validada em 20/07/2026.
- `scripts/import-funcionarios.py` importa somente funcionario, CPF, cidade de atuacao e data do proximo ASO.
- A carga atual possui 170 colaboradores e CPFs unicos; 3 nao possuem data de ASO.
- O checklist possui 18 requisitos padrao e permite documentos personalizados.
- Documentos sao selecionados por colaborador vinculado ao caso.
- CPF, ASO e checklist individual ficam restritos ao perfil `operacao_eqs`.
