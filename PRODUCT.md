# PRODUCT

## Plataforma

Web mobile-first, HTML/CSS/JS puro, servida em localhost por um servidor Node sem dependências. Sem build e sem framework.

## Stack

HTML semântico, CSS com tokens, JavaScript progressivo e funcional offline para a simulação. O checkout continua externo na PerfectPay. O player VSL e os depoimentos usam os smart players da ConverteAI quando a rede permite.

## Usuários

Casais brasileiros, majoritariamente no celular, que chegam por anúncio de rede social. Querem uma resposta rápida sobre o que o parceiro faz no WhatsApp sem instalar aplicativo, criar conta ou enviar conversa.

## Propósito

Clonar fielmente, para referência local, o funil `chavedoamor.site/try` → `/try/cta`. A entrada pede um número de WhatsApp e encena uma análise; a página de resultado apresenta um relatório simulado e vende o relatório completo por R$137, ancorado em R$197, via PerfectPay/Pix.

## Posicionamento

"Descubra a verdade sem que ele saiba." A prova é visual e quantitativa: mensagens apagadas, fotos privadas, horários, localização e áudios aparecem parcialmente, com os detalhes borrados atrás do paywall.

## Contexto de operação

O domínio publicado está com a raiz em branco e os endpoints de scan em 404. A versão completa está em `/try` e `/try/cta`. O clone usa a versão completa como fonte, simula o scan localmente e mantém o checkout original. A oferta e os números do relatório são fixos, como no original.

## Capacidades e restrições

- Duas rotas: `/try` (telefone e análise) e `/try/cta` (relatório e oferta).
- Telefone brasileiro com prefixo +55, máscara e validação.
- Progresso persistente, cinco itens de análise, CTA revelado ao fim do pitch.
- Contador de 10 minutos persistente.
- Cidade por IP com fallback; foto por API simulada/local com fallback.
- Link de checkout com `payment=pix`, `phone`, `src=W-FRONT`, UTMs e `vid`.
- Sem CNPJ, e-mail de suporte, política publicada ou dados legais no material.
- A promessa de "100% anônimo" e os números do relatório não são auditáveis no original.

## Compromissos de marca

- Fundo claro; cartões claros; blocos escuros reservados à tela de WhatsApp e às provas.
- Verde WhatsApp (`#25D366`, `#128C7E`, `#075E54`) e tela de conversa (`#0B141A`, `#DCF8C6`).
- Logo ZapRadar, tipografia system UI, cartões arredondados, cadeados e blur como paywall.
- Copy, ordem, números, preço, garantia e ortografia do original são preservados.

## Evidência disponível

- `chavedoamor.site/try` e `chavedoamor.site/try/cta`, HTML colhido em 26/11/2026.
- `reference-try.html`, `reference-cta.html`, `sources.json` e assets originais em `.bunshin/harvest/`.
- Pesquisa de concorrentes, padrões premium, páginas de resultado e acessibilidade em `.bunshin/research/`.
- Capturas de referência e métricas de layout em `.bunshin/captures/reference/`.

## O que nunca inventar

- Depoimentos, nomes, cidades, CNPJ, prazos de entrega por e-mail e canais de suporte.
- Números novos de mensagens, fotos, áudios ou locais.
- Mudança de preço, garantia, link PerfectPay ou números de telefone reais.
- Que o scan lê o WhatsApp de fato; o clone deve se apresentar como demonstração.

## Princípios

1. Uma decisão por tela e um único campo.
2. Fidelidade ao original antes de preferência pessoal.
3. Mobile primeiro em 320–430 px; desktop centraliza a mesma coluna.
4. Prova antes do discurso; oferta só depois de duas provas.
5. Tudo verificável por captura, medida e teste funcional.
6. Sem gate novo, popup, carrossel ou cross-sell.
7. Acessibilidade AA sem descaracterizar cores e hierarquia.
8. Nada depende de um endpoint quebrado para o fluxo funcionar.

## Acessibilidade e inclusão

Meta WCAG 2.2 AA nos pontos aplicáveis: formulário semântico, erro anunciado, foco visível, alvos de 48 px, contraste 4,5:1, reflow em 320 px e 200% de zoom, safe areas, legendas e redução de movimento. Entrada por teclado e leitor de tela completa. Texto em português brasileiro.
