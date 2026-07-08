import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import cron from "node-cron";

dotenv.config();

try {
  admin.initializeApp();
  console.log("[Firebase Admin] Inicializado com sucesso via ADC.");
} catch (adminError: any) {
  console.warn("[Firebase Admin] Falha na inicialização padrão. Tentando inicialização sem explicit credential:", adminError?.message || adminError);
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: "gen-lang-client-0135363209"
      });
      console.log("[Firebase Admin] Inicializado com projectId explícito.");
    }
  } catch (err2: any) {
    console.error("[Firebase Admin] Falha crítica de inicialização do Firebase Admin:", err2?.message || err2);
  }
}

let aiClient: GoogleGenAI | null = null;
function getGemini() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A chave GEMINI_API_KEY não está configurada nos Secrets da aplicação.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn("[Push] VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configuradas nos Secrets da aplicação.");
} else {
  try {
    webpush.setVapidDetails(
      "mailto:lucasgoncalvestributario@gmail.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log("[Push] VAPID configurado com sucesso.");
  } catch (err: any) {
    console.error("[Push] Falha ao configurar VAPID:", err?.message || err);
  }
}

async function sendDailyVendedorReminder() {
  console.log("[Scheduler] Iniciando envio do lembrete diário de vendas...");
  try {
    const firestore = admin.firestore();
    const tokensSnap = await firestore.collectionGroup('push_tokens')
      .where('role', '==', 'vendedor')
      .get();
      
    const subscriptions: any[] = [];
    tokensSnap.forEach(doc => {
      const data = doc.data();
      if (data && data.subscription) {
        subscriptions.push(data.subscription);
      }
    });

    const uniqueSubs = Array.from(new Map(subscriptions.map(s => [s.endpoint, s])).values());
    console.log(`[Scheduler] Encontradas ${uniqueSubs.length} inscrições exclusivas de vendedores.`);

    if (uniqueSubs.length === 0) {
      console.log("[Scheduler] Nenhuma inscrição de vendedor ativa para enviar push.");
      return { success: true, sentCount: 0, staleCount: 0 };
    }

    const payload = {
      title: "📝 Lembrete de Vendas Diárias",
      body: "Bom dia! Não se esqueça de preencher suas vendas diárias no sistema hoje. Boas vendas! 🚀",
      targetTab: "vendas",
      type: "venda"
    };

    let successCount = 0;
    let staleCount = 0;

    for (const sub of uniqueSubs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        successCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
          staleCount++;
          try {
            const querySnap = await firestore.collectionGroup('push_tokens')
              .where('subscription.endpoint', '==', sub.endpoint)
              .get();
            querySnap.forEach(async (d) => {
              await d.ref.delete();
            });
          } catch (delErr) {
            console.warn("[Scheduler Cleanup Error]", delErr);
          }
        } else {
          console.error("[Scheduler Push Error]", err.message || err);
        }
      }
    }

    console.log(`[Scheduler] Lembrete diário enviado. Sucesso: ${successCount}, Expirados: ${staleCount}`);
    return { success: true, sentCount: successCount, staleCount };
  } catch (error: any) {
    console.error("[Scheduler Error] Falha crítica no envio do lembrete:", error);
    return { success: false, error: error.message || error };
  }
}

// Lembrete automático às 09:00 de Brasília para os vendedores preencherem suas vendas
cron.schedule('0 9 * * *', () => {
  console.log("[Cron] Executando lembrete agendado de 09:00...");
  sendDailyVendedorReminder();
}, {
  timezone: "America/Sao_Paulo"
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Disparar Lembrete Diário para todos os vendedores manualmente (para testes)
  app.post("/api/trigger-vendedor-reminder", async (req, res) => {
    try {
      console.log("[API/Trigger] Recebida requisição para disparar lembrete diário manual.");
      const result = await sendDailyVendedorReminder();
      res.json(result);
    } catch (e: any) {
      console.error("[API/Trigger] Erro ao disparar lembrete:", e);
      res.status(500).json({ error: e.message || e });
    }
  });

  // API: Enviar Notificação Push
  app.post("/api/push-notify", async (req, res) => {
    const { subscriptions, payload } = req.body;
    
    if (!subscriptions || !Array.isArray(subscriptions)) {
      return res.status(400).json({ error: "Subscriptions array required" });
    }

    const notifications = subscriptions.map(sub => {
      return webpush.sendNotification(sub, JSON.stringify(payload))
        .then(() => ({ endpoint: sub.endpoint, success: true }))
        .catch(err => {
          // Se for uma expiração de subscrição esperada (410 Gone ou 404 Not Found),
          // podemos classificar como stale para remoção no Firestore e logar de forma silenciosa.
          const isStale = err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403;
          if (isStale) {
            console.log(`[Push Subscription] Inscrição expirada/inválida (Status ${err.statusCode}) no endpoint: ${sub.endpoint}`);
          } else {
            console.log(`[Push Notification] Falha ao enviar (Status ${err.statusCode || 'N/A'}): ${err.message || err}`);
          }
          return { endpoint: sub.endpoint, failed: true, isStale };
        });
    });

    const results = await Promise.all(notifications);
    
    const failedEndpoints = results
      .filter(r => r && (r as any).failed)
      .map(r => (r as any).endpoint);
    
    const staleEndpoints = results
      .filter(r => r && (r as any).failed && (r as any).isStale)
      .map(r => (r as any).endpoint);

    res.json({ success: true, failedEndpoints, staleEndpoints });
  });

  // API: Processar preenchimento de contrato por áudio (Apenas Lucas Gonçalves)
  app.post("/api/parse-contract-voice", async (req, res) => {
    const { text, userEmail } = req.body;

    if (!text) {
      return res.status(400).json({ error: "O texto de transcrição é obrigatório" });
    }

    const allowedLucasEmails = [
      'lucasgoncalvestributario@gmail.com',
      'goncalvesopera@gmail.com',
      'operaformacao@gmail.com',
      'operaformacar@gmail.com',
      'lucas@opera.com'
    ];

    if (!userEmail || !allowedLucasEmails.includes(userEmail.toLowerCase())) {
      return res.status(403).json({ error: "Este recurso inteligente está disponível exclusivamente para Lucas Gonçalves." });
    }

    try {
      const model = "gemini-3.5-flash";
      const systemInstruction = 
        "Você é uma inteligência artificial altamente avançada, especializada em extrair e preencher dados cadastrais " +
        "de contratos a partir de uma transcrição falada de áudio em português para a Opera Formação.\n" +
        "O usuário ditará múltiplas informações do contrato de uma vez (ex: 'o consultor é Lucas, o cliente é Eduardo da Silva, CPF dele é 111.222.333-44, RG 555-66, nasceu em dez de janeiro de noventa, telefone 48 99999-8888, mora na rua das flores, numero dez, em Florianópolis, o curso é de retroescavadeira, em Mafra, nos dias 12 a 14 de junho, matrícula de 200, restante de 1700, precisa de alojamento e observação teste').\n\n" +
        "Regras estritas de inteligência artificial de extração e formatação:\n" +
        "1. ENTENDA MÚLTIPLOS CAMPOS SIMULTÂNEOS: Analise a transcrição por completo e extraia cada detalhe correspondente a cada um dos campos do contrato, sem omitir ou ignorar qualquer informação ditada.\n" +
        "2. NORMALIZE STRINGS VAZIAS: Caso um campo do formulário NÃO seja falado ou não haja pista inteligível na transcrição para preenchê-lo, retorne este campo obrigatoriamente como uma string vazia (\"\"). Jamais retorne null ou remova chaves do JSON.\n" +
        "3. CPFs, RGs, CEPs e TELEFONES: Limpe ruídos e palavras fonéticas extras como 'ponto', 'traço', 'hífen', 'barra' do texto, extraindo apenas os números e as formatações cabíveis. Formate CPF como '000.000.000-00', CEP como '00000-000'. Se o telefone tiver DDD, deixe formatado como '(99) 99999-9999' ou similar.\n" +
        "4. NOME DO CLIENTE: Extraia o nome completo do cliente para 'clientName' com todas as primeiras letras maiúsculas. Ignore termos introdutórios (ex: 'cadastra aí', 'o cliente é', 'nome').\n" +
        "5. CIDADES E ESTADOS (UF): Discerna perfeitamente estado de cidade. O campo 'estado' deve ser estritamente a sigla de 2 caracteres maiúsculos (ex: 'SC', 'PR', 'SP', 'RS'). Se o usuário falar apenas o nome do estado, extraia a sigla correspondente.\n" +
        "6. VALORES MONETÁRIOS (matriculaValue, remainderValue): Normalize valores numéricos ditados para o formato decimal e string brasileira com duas casas decimais (ex: 'duzentos reais' vira '200,00', 'mil e setecentos' vira '1.700,00', 'cinquenta' vira '50,00', 'mil seiscentos e noventa e nove' vira '1.699,00').\n" +
        "7. ALOJAMENTO (needsLodging): Se houver menção de que o cliente precisa de alojamento, pousada, hospedagem, hotel ou 'com alojamento', defina 'needsLodging' estritamente como 'SIM'. Do contrário, retorne 'NÃO'.\n" +
        "8. INTEGRIDADE JSON: Retorne única e exclusivamente o objeto JSON contendo exatamente as chaves do esquema.";

      const response = await getGemini().models.generateContent({
        model: model,
        contents: `Transcrição de áudio contínua de vários dados:\n"${text}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nome: { type: Type.STRING, description: "Nome completo do cliente contratante." },
              cpf: { type: Type.STRING, description: "CPF do cliente, limpo e formatado como 000.000.000-00." },
              rg: { type: Type.STRING, description: "RG do cliente." },
              endereco: { type: Type.STRING, description: "Endereço / Nome da rua do cliente." },
              numero: { type: Type.STRING, description: "Número do endereço do cliente." },
              bairro: { type: Type.STRING, description: "Bairro do cliente." },
              cidade: { type: Type.STRING, description: "Cidade do cliente." },
              estado: { type: Type.STRING, description: "Estado/UF com 2 letras maiúsculas (ex: SC, PR, SP)." },
              telefone: { type: Type.STRING, description: "Telefone do cliente, formatado como (47) 99999-9999 ou similar." },
              email: { type: Type.STRING, description: "E-mail do cliente contratante." },
              profissao: { type: Type.STRING, description: "Profissão do cliente." },
              estadoCivil: { type: Type.STRING, description: "Estado civil do cliente (ex: Solteiro, Casado, Divorciado)." },
              nacionalidade: { type: Type.STRING, description: "Nacionalidade do cliente." },
              dataNascimento: { type: Type.STRING, description: "Data de nascimento do cliente no formato DD/MM/AAAA." },
              valor: { type: Type.STRING, description: "Valor pago de matrícula ou total citado, formatado como dezimal string brasileira (ex: 200,00 ou 1.699,00)." },
              dataContrato: { type: Type.STRING, description: "Data do contrato ou data do curso citada (ex: 12-14 de JUNHO)." },
              cep: { type: Type.STRING, description: "CEP do cliente, formatado como 00000-000." },
              needsLodging: { type: Type.STRING, description: "Se o cliente precisa de alojamento/hospedagem, retorne 'SIM', caso contrário retorne 'NÃO'." },
              consultant: { type: Type.STRING, description: "Nome do consultor / vendedor citado." },
              cidadeCurso: { type: Type.STRING, description: "Cidade onde será o curso." },
              valorRestante: { type: Type.STRING, description: "Valor restante a ser pago pelo curso." },
              observacoes: { type: Type.STRING, description: "Outras observações extraídas da fala." }
            }
          }
        }
      });

      const responseText = response.text ? response.text.trim() : "";
      console.log("[Gemini Speech Raw Response]:", responseText);

      let extractedData = {};
      try {
        let cleanText = responseText;
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith("```")) {
          cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith("```")) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        cleanText = cleanText.trim();

        const firstBrace = cleanText.indexOf("{");
        const lastBrace = cleanText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        extractedData = JSON.parse(cleanText);
      } catch (err) {
        console.warn("[Gemini Speech JSON Parse Warning] Tentando limpar caracteres de controle inválidos...", err);
        try {
          let aggressiveText = responseText.replace(/[\u0000-\u0019]+/g, "");
          const firstBrace = aggressiveText.indexOf("{");
          const lastBrace = aggressiveText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace !== -1) {
            aggressiveText = aggressiveText.substring(firstBrace, lastBrace + 1);
          }
          extractedData = JSON.parse(aggressiveText);
        } catch (errAggressive) {
          console.error("[Gemini Speech JSON Parse Error] Falha fatal de parse:", errAggressive);
          throw new Error("A IA gerou dados fora de formato. Por favor, dite as informações novamente.");
        }
      }

      res.json({ success: true, data: extractedData });
    } catch (error: any) {
      console.error("Erro ao analisar áudio com Gemini:", error);
      res.status(500).json({ error: error?.message || "Falha ao processar o áudio com a IA." });
    }
  });

  // Função de Fallback Local Inteligente - Garante resposta natural e humana mesmo se a IA falhar
  function getLocalFallbackResponse(userMessage: string): string {
    const text = (userMessage || "").toLowerCase().trim();

    if (text === "oi" || text === "olá" || text === "ola" || text === "bom dia" || text === "boa tarde" || text === "olá, tudo bem?") {
      return "Oi, tudo bem? Que bom falar com você! Me conta, você já trabalha na área ou seria seu primeiro curso?";
    }

    if (text.includes("qual valor") || text.includes("preço") || text.includes("custo") || text.includes("quanto custa") || text.includes("valores")) {
      return "Já te explico isso, mas me conta rapidinho o que te chamou atenção nas máquinas pesadas.";
    }

    if (text.includes("já tenho experiência") || text.includes("ja tenho experiencia") || text.includes("tenho experiência")) {
      return "Muito legal! Ter experiência prévia facilita bastante o processo de certificação e aprendizado das novas máquinas. Com quais modelos você já trabalhou?";
    }

    if (text.includes("primeiro curso") || text.includes("é meu primeiro") || text.includes("nunca fiz")) {
      return "Fazer o primeiro curso é uma grande conquista e abre muitas portas! Nós acolhemos todo mundo que está começando do absoluto zero e damos toda a segurança e suporte nas aulas práticas.";
    }

    if (text.includes("caro") || text.includes("salgado") || text.includes("preço alto") || text.includes("muito caro")) {
      return "Essa questão do investimento é super comum e muito importante de avaliar. Normalmente, vale a pena entender com o que o cliente está comparando para ressaltar as nossas aulas práticas em máquinas reais e o certificado nacional. O que você sente que pesa mais para ele?";
    }

    if (text.includes("vou pensar") || text.includes("pensar") || text.includes("analisar")) {
      return "O tempo de reflexão faz parte do processo de qualquer decisão importante. Uma ótima saída aqui é manter a porta aberta de forma leve e perguntar se faltou alguma informação sobre as aulas práticas ou certificado. Como você costuma dar esse retorno?";
    }

    if (text.includes("sem dinheiro") || text.includes("dinheiro") || text.includes("liso") || text.includes("apertado")) {
      return "Essa situação financeira exige muito cuidado e empatia no atendimento. O melhor caminho é mostrar o retorno rápido que a profissão de operador de máquinas traz e oferecer formas de parcelamento facilitadas. O que acha de propor uma simulação mais leve?";
    }

    if (text.includes("sem tempo") || text.includes("tempo") || text.includes("corrido")) {
      return "A correria do dia a dia é um desafio real para muitos alunos. O ideal é ressaltar que nossa formação é intensiva e focada na prática no fim de semana para não atrapalhar o trabalho dele. Qual horário você sugeriu para falar com ele?";
    }

    if (text.includes("esposa") || text.includes("marido") || text.includes("família") || text.includes("falar com")) {
      return "Decidir em família é sempre o melhor caminho e traz muito apoio. Uma boa ideia é enviar fotos das nossas máquinas de verdade e do certificado nacional para ele mostrar em casa. Quer que eu te passe esses materiais agora?";
    }

    if (text.includes("sumiu") || text.includes("não responde") || text.includes("vácuo") || text.includes("ignora")) {
      return "Isso acontece bastante no dia a dia. Uma retomada sem pressão é o melhor caminho, mostrando que você está aqui para ajudar e não para forçar uma venda. Você já tentou mandar um áudio descontraído ou fotos das máquinas?";
    }

    if (text.includes("cansado") || text.includes("cansada") || text.includes("esgotado")) {
      return "Esses dias puxados drenam bastante a nossa energia. Se quiser, faz uma pausa rápida para respirar e depois voltamos com tudo nos treinamentos.";
    }

    if (text.includes("não sei") || text.includes("nao sei") || text.includes("não tenho informação")) {
      return "Não tenho informação suficiente para afirmar isso.";
    }

    if (text === "quanto é 2+2" || text === "2+2") {
      return "4";
    }

    return "Boa colocação. No atendimento do dia a dia, nosso foco é sempre entender o momento de vida da pessoa e oferecer a melhor orientação. Onde você sente que está o maior desafio na sua rotina atual?";
  }

  // API: Chatbot de IA de Treinamento e Vendas (Consultor IA)
  app.post("/api/gemini-chat", async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "O histórico de mensagens é obrigatório." });
    }

    const startTime = Date.now();
    let status = "success";
    let errorMessage = "";
    const lastUserMessage = messages.length > 0 ? messages[messages.length - 1].content : "";

    try {
      // REGRA 5 — CONTEXTO: Limitar contexto enviado. Usar apenas as últimas 10 mensagens.
      const last10Messages = messages.slice(-10);

      const systemInstruction = 
        "Você é o 'Consultor IA' da Opera Formação, atuando como um TREINADOR DE VENDAS e COACH de atendimento para a equipe de consultores.\n\n" +
        "SUA MISSÃO E IDENTIDADE:\n" +
        "- Você NÃO é o vendedor final. Você é o TREINADOR dos vendedores/consultores da escola.\n" +
        "- Quando um consultor te fizer perguntas no chat, seu papel é orientá-lo passo a passo sobre como agir, como se comportar e o que enviar para o cliente final, sempre baseado no SCRIPT e na FILOSOFIA de atendimento humano da Opera Formação.\n" +
        "- Ensine a nunca tratar pessoas como números. A base é ser humano, criar conexões reais (cidade, clima, interesses) e mostrar que estamos aqui para ajudar e realizar sonhos.\n\n" +
        "FILOSOFIA DE VENDAS DA OPERA FORMAÇÃO:\n" +
        "- Toda pessoa que entra em contato está buscando alguma mudança (mais renda, trocar de profissão, crescimento, curiosidade ou aprendizado). Nosso papel é descobrir, entender, explicar e ajudar. A venda é consequência natural.\n" +
        "- COMPORTAMENTO EXIGIDO: Nunca pareça um robô. Nunca use frases repetitivas. Nunca use formatos fixos ou estruturados de relatórios. Nunca use em suas respostas seções como 'RESUMO', 'ANÁLISE', 'COMO RESPONDER' ou 'PRÓXIMO PASSO'. Converse de forma fluida, natural, prestativa e humana.\n\n" +
        "REGRAS CRÍTICAS DE COMUNICAÇÃO (EVITAR PERGUNTAS REPETIDAS):\n" +
        "- REGRA PRINCIPAL: Sempre RESPONDA PRIMEIRO, depois pergunte (se realmente precisar). Entregue valor real, orientação, comentário ou opinião antes de qualquer questionamento. Nunca comece com uma pergunta.\n" +
        "- É TERMINANTEMENTE PROIBIDO iniciar respostas com termos robóticos ou clichês, como: 'Entendo perfeitamente', 'Entendi', 'Compreendo', 'Pode explicar melhor'. Comece direto com a resposta real, comentário, ideia, solução ou orientação.\n" +
        "- Não faça entrevista nem interrogatório. Não fique pedindo constantemente 'objetivos' ou 'contexto' em todas as mensagens. Comporte-se como um colega humano e treinador amigável.\n" +
        "- LIMITE DE PERGUNTAS: No máximo 1 pergunta por resposta. Se a conversa flui bem, faça apenas comentários ou orientações sem perguntas.\n" +
        "- EXEMPLOS DE COMPORTAMENTO CORRETO:\n" +
        "  * Usuário diz: 'Meu cliente sumiu.' -> Resposta: 'Isso acontece mais do que parece. Normalmente eu tentaria retomar o contato sem pressão, enviando fotos das máquinas do curso para reatar a conversa de forma descontraída. Você já tentou fazer algo parecido?'\n" +
        "  * Usuário diz: 'Quero vender mais.' -> Resposta: 'Eu começaria olhando para a quantidade de contatos diários, a qualidade do atendimento e o tempo de retorno. O segredo principal do nosso script é focar na conexão humana e não parecer telemarketing.'\n" +
        "  * Usuário diz: 'Hoje foi corrido.' -> Resposta: 'Esses dias puxados drenam bastante a nossa energia física e mental mesmo.'\n" +
        "  * Usuário diz: 'Quero fazer o curso.' -> Resposta: 'Excelente decisão! A profissão de operador de máquinas pesadas tem uma demanda gigante no mercado hoje. Me conta, seria seu primeiro curso na área?'\n\n" +
        "PASSO A PASSO DO SCRIPT (CURSO PRESENCIAL):\n" +
        "Ensine os consultores a seguirem este fluxo quando perguntarem sobre o script:\n" +
        "1. PRIMEIRO CONTATO (Video Inicial + Apresentação + Nome):\n" +
        "   - Enviar o vídeo inicial (quebra a objeção de 'golpe'), se apresentar e descobrir o nome, se é o primeiro curso ou se já tem experiência.\n" +
        "   - Script modelo: '(VÍDEO INICIAL + ÁUDIO + FOTO NO CURSO) - Opa, tudo bem? Meu nome é [Nome], sou coordenador aqui da escola, só me passa o teu nome por gentileza e se é seu primeiro curso, se você já teve experiência com máquinas que já vou te explicar certinho.'\n" +
        "2. ENTENDENDO O PERFIL (Começando do zero + Motivo da procura):\n" +
        "   - Script modelo (Áudio 1): 'João, bem tranquila tá, o curso é voltado pra quem vai começar do zero mesmo, tanto na questão do teu aprendizado com as máquinas, quanto toda documentação que você precisa pra poder operar, carteira de operador, credenciamento, certificado...'\n" +
        "   - Script modelo (Áudio 2): 'Mas só pra eu te entender, o que te levou a procurar esse curso? Você trabalha em que área hoje?'\n" +
        "3. VALORIZAÇÃO & INSTIGAR (Salários + Liberdade + Plano de carreira):\n" +
        "   - Script modelo (Áudio 1): 'Ah certo, então... na tua profissão eu imagino que você consiga fazer um bom salário, mas hoje como operador, o salário INICIAL é de 3.800 a 4.000 e chega até cinco, seis, sete mil, dependendo o quanto você vai trabalhar e pra qual empresa também. Aqui na escola você vai ter 3 máquinas no curso, então você pode trabalhar fixo durante a semana com uma das máquinas, e fazer um serviço por fora com alguma outra... fora o plano de carreira do operador, se você é um cara dedicado, proativo, já mira numa vaga de encarregado e o salário já bate ali em 6, 7... e isso pra trabalhar tranquilo, escutando tua musiquinha, normalmente as máquinas tem ar condicionado... e DEPOIS, quem sabe você mesmo compra sua máquina, começa numa pequena, depois vai pra uma maior, pode trabalhar na sua própria máquina, ou contratar alguém pra trabalhar pra VOCÊ, na SUA própria máquina... então é uma profissão que pode te dar liberdade também...'\n" +
        "4. CHAMADA PARA LIGAÇÃO:\n" +
        "   - Script modelo (Áudio 2): 'João, te falei um pouco sobre a profissão, agora sobre teu curso, é bastante informação mesmo, são 3 dias de formação, com 3 máquinas, formação profissionalizante completa... eu tô bem corrido aqui no escritório, provavelmente final de semana já encerro essa turma... daqui uma horinha eu consigo te atender numa ligação, 5 minutos já te passo tudo sem compromisso, e você decide se é o que está procurando... nesse horário fica bom pra você?'\n" +
        "   - Horários ideais: Meio-dia (para quem trabalha de manhã) ou 18h (para quem trabalha de tarde). Não ligar muito tarde da noite.\n\n" +
        "A LIGAÇÃO (COMO SE COMPORTAR):\n" +
        "- Orientar a usar o lado humano unido ao conhecimento na palma da mão. Romper o gelo nos primeiros 2 a 3 minutos falando de clima, cidade, etc. Ex: 'Fala João, tudo certo? Quer dizer então que vamos pros monstros de ferro agora? Rapaz, tá um frio aqui na cidade, você é de [cidade] mesmo?'\n" +
        "- Fazer a virada de chave com a frase de ouro: 'Show de bola João, então vamos falar de coisa boa, vou te explicar rapidinho como funciona o curso, pra não tomar muito teu tempo'.\n" +
        "- Exaltar a escola primeiro. Manter o diálogo (explicar um pouco, perguntar um pouco). Se o cliente interromper com perguntas fora de hora, usar a frase: 'Já vou tirar tua dúvida, só vou seguir aqui pra você entender melhor, e já falamos disso... continuando então...'.\n\n" +
        "SITUAÇÃO: LIGAÇÃO NÃO FOI POSSÍVEL (ÁUDIO E VÍDEO):\n" +
        "Se o consultor não conseguir agendar a ligação, ensine a seguir por áudio e vídeo:\n" +
        "- Passo 1 (Fazer um combinado): 'João, vamos combinar assim então, vou te passar tudo por aqui, alguns vídeos do curso, depoimentos, nossas redes sociais, CNPJ e vou enviar um áudio com todas informações, você olha ali tudo com calma e vai me mandando as dúvidas, PODE SER?' (ALERTA CRÍTICO: Nunca enviar o valor no primeiro momento!)\n" +
        "- Passo 2: Enviar vídeos (completo, instrutor, depoimento, redes sociais/CNPJ, tour pela escola) + áudio explicativo personalizado e texto abaixo: 'João, escuta com atenção, vê os vídeos, e me manda aqui suas dúvidas depois já te passo o valor e se for o que você precisa, vamos pra cima'.\n" +
        "- Passo 3 (Confirmar visualização): Quando o cliente perguntar o valor: 'Já vou te passar o restante, conseguiu ver tudo certinho, quer perguntar mais alguma coisa?'\n" +
        "- Passo 4: Após confirmação, enviar áudio explicando valor, parcelamento, reforçando os sonhos e motivos que ele deu (ex: 'assim te ajuda a realizar teu sonho né João?', 'fica mais leve pra você o trabalho né João...').\n\n" +
        "SITUAÇÃO: NÃO RESPONDEU OU IGNOROU (PASSO 5):\n" +
        "- Enviar: 'João vi que você não respondeu, imagino que deve ter ficado alguma dúvida, ou o valor não ficou legal pra agora, é normal pode ficar tranquilo. Mas me diz aqui que te ajudo com o que puder, só não podemos te deixar de fora, o que você precisa?'\n" +
        "- Se continuar ignorando, vira remarketing.\n\n" +
        "DIVERSOS (CONCEITOS SOBRE MÁQUINAS, SALÁRIOS E MERCADO):\n" +
        "- Máquinas: Retroescavadeira, Escavadeira, Bobcat, Pá carregadeira, Empilhadeira, Trator, Rolo compactador, Guindaste, Munck, Motoniveladora. Explique o uso geral e mercado sem inventar dados técnicos.\n" +
        "- Mercado e Emprego: Explicar que as oportunidades variam e a qualificação ajuda. NUNCA prometa emprego, NUNCA garanta renda ou contratação.\n" +
        "- Salários: Não prometa valores fixos. Explique que a remuneração varia conforme a região, empresa, experiência e função.\n" +
        "- Certificações (CREA, CRT, NR, registro): Explique o conceito geral, nunca afirme obrigatoriedade cega e oriente a confirmar com o órgão competente.\n" +
        "- SE NÃO SOUBER de algo específico ditado pelo consultor, use a frase: 'Não tenho informação suficiente para afirmar isso.' Nunca invente nada.\n\n" +
        "Converse de forma natural, amigável e direta com o consultor, ajudando-o a dominar o script e as técnicas humanas de negociação da Opera Formação!\n\n" +
        "OBJETIVO FINAL: Toda pessoa deve sair mais esclarecida do que entrou.";

      // Transform messages into format expected by @google/genai
      const contents = last10Messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const model = "gemini-3.5-flash";
      const response = await getGemini().models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      let responseText = response.text ? response.text.trim() : "";
      if (!responseText) {
        responseText = getLocalFallbackResponse(lastUserMessage);
        status = "empty_fallback";
      }

      const durationMs = Date.now() - startTime;
      
      console.log(`[IA-LOG] Pergunta: "${lastUserMessage.substring(0, 100)}" | Tempo: ${durationMs}ms | Status: ${status}`);

      res.json({ 
        success: true, 
        text: responseText, 
        log: {
          question: lastUserMessage,
          durationMs,
          status,
          error: null
        }
      });
    } catch (error: any) {
      status = "local_fallback";
      errorMessage = error?.message || "Erro desconhecido";
      const durationMs = Date.now() - startTime;
      console.error(`[IA-LOG] Erro no Gemini-Chat:`, error);
      
      const fallbackResponse = getLocalFallbackResponse(lastUserMessage);
      res.json({ 
        success: true,
        text: fallbackResponse,
        error: errorMessage,
        log: {
          question: lastUserMessage,
          durationMs,
          status,
          error: errorMessage
        }
      });
    }
  });

  // API: Enviar WhatsApp via Wasseler (Apenas para Lucas Gonçalves)
  app.post("/api/send-wasseler", async (req, res) => {
    const { phone, message, userEmail } = req.body;

    if (!phone || !message || !userEmail) {
      return res.status(400).json({ error: "Campos obrigatórios: phone, message, userEmail" });
    }

    const emailLower = userEmail.toLowerCase();
    
    const allowedEmails = [
      'lucasgoncalvestributario@gmail.com',
      'goncalvesopera@gmail.com',
      'operaformacao@gmail.com',
      'operaformacar@gmail.com',
      'lucas@opera.com'
    ];

    // Garantir rigorosamente que SÓ Lucas Gonçalves possa usar esta chave
    if (!allowedEmails.includes(emailLower)) {
      return res.status(403).json({ error: "Este recurso está disponível apenas para o acesso de Lucas Gonçalves." });
    }

    const token = "1780401812810-2226f44fc2d9b5aeb60851b3d3e24173";

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 5 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    const urls = [
      'https://api.wuseller.com/api/v1/send',
      'https://api.waseller.com.br/api/v1/send',
      'https://app.wuseller.com/api/v1/send',
      'https://api.wuseller.com/v1/messages'
    ];

    let success = false;
    let lastError = null;
    let responseData = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-api-key': token
          },
          body: JSON.stringify({
            phone: cleanPhone,
            to: cleanPhone,
            message: message,
            text: message
          })
        });

        if (response.ok) {
          responseData = await response.json().catch(() => ({}));
          success = true;
          break;
        } else {
          const errorText = await response.text();
          lastError = new Error(`Status ${response.status}: ${errorText}`);
        }
      } catch (e: any) {
        lastError = e;
      }
    }

    if (success) {
      return res.json({ success: true, responseData });
    } else {
      return res.status(500).json({ error: lastError?.message || "Erro ao conectar à API do Wasseler." });
    }
  });

  // API: Enviar WhatsApp via WAScript (Vendedores / Lucas Gonçalves)
  app.post("/api/send-wascript", async (req, res) => {
    const { phone, message, pdfBase64, fileName, userEmail, wascriptToken } = req.body;

    if (!phone || !userEmail) {
      return res.status(400).json({ error: "Campos obrigatórios: phone, userEmail" });
    }

    // Usar o token fornecido pela UI (configurado no perfil) ou de variável de ambiente
    const activeToken = wascriptToken || process.env.WASCRIPT_TOKEN;

    if (!activeToken) {
      return res.status(400).json({ error: "Token do WAScript não está configurado. Cadastre-o na aba Perfil!" });
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 5 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    // No WAScript, o envio de documento espera o base64 com ou sem cabeçalho padrão de data URI.
    // Para total compatibilidade, enviaremos com cabeçalho.
    const base64WithHeader = pdfBase64.includes(';base64,') ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`;

    const payloadDoc = {
      numero: cleanPhone,
      documento: base64WithHeader,
      nome_arquivo: fileName || "Contrato_Opera.pdf",
      nomeArquivo: fileName || "Contrato_Opera.pdf",
      filename: fileName || "Contrato_Opera.pdf",
      mensagem: message || "",
      caption: message || "",
      texto: message || ""
    };

    const urlDoc = `https://api-whatsapp.wascript.com.br/api/enviar/documento/${activeToken}`;

    try {
      console.log(`[WAScript] Enviando contrato para ${cleanPhone}...`);
      
      const response = await fetch(urlDoc, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payloadDoc)
      });

      const responseText = await response.text();
      console.log(`[WAScript] Resposta (status ${response.status}):`, responseText);

      if (response.ok) {
        let responseData = {};
        try {
          responseData = JSON.parse(responseText);
        } catch (_) {}
        return res.json({ success: true, responseData });
      } else {
        return res.status(response.status).json({ error: `WAScript retornou status ${response.status}: ${responseText}` });
      }
    } catch (e: any) {
      console.error("[WAScript] Erro de rede:", e);
      return res.status(500).json({ error: `Erro de rede ao conectar à API do WAScript: ${e.message || e}` });
    }
  });

  // API: Enviar dados de contrato para o Webhook do Google Sheets
  app.post("/api/trigger-sheets-webhook", async (req, res) => {
    const { webhookUrl, rowData } = req.body;

    if (!webhookUrl || !rowData) {
      return res.status(400).json({ error: "Campos obrigatórios: webhookUrl, rowData" });
    }

    try {
      console.log(`[Sheets Webhook] Acionando webhook: ${webhookUrl} ...`);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rowData)
      });

      const responseText = await response.text();
      const isHtml = responseText.includes("<!DOCTYPE") || responseText.includes("<html") || responseText.includes("<body") || responseText.includes("<div");
      const cleanLogMessage = isHtml ? "[Recipiente HTML recebido do Google]" : responseText.substring(0, 150);
      console.log(`[Sheets Webhook] Resposta status: ${response.status}`, cleanLogMessage);

      if (!response.ok) {
        let isSpreadsheetUrlDirect = webhookUrl.includes("docs.google.com/spreadsheets");
        let extraInfo = isSpreadsheetUrlDirect 
          ? " (Parece que você usou o link direto da planilha. Você precisa instalar o Google Apps Script e usar o link de 'App da Web' gerado na implantação!)" 
          : "";
        return res.json({ 
          success: false, 
          status: response.status, 
          error: `O servidor da planilha retornou erro HTTP ${response.status}${extraInfo}` 
        });
      }

      return res.json({ success: true, status: response.status, responseText });
    } catch (e: any) {
      console.error("[Sheets Webhook] Erro:", e);
      return res.json({ success: false, error: e.message || e });
    }
  });

  // API: Exportar diretamente usando a API do Google Sheets (token do usuário)
  app.post("/api/export-to-google-sheets-api", async (req, res) => {
    const { spreadsheetUrl, googleSheetsToken, tabName, rowValues } = req.body;

    if (!spreadsheetUrl || !googleSheetsToken || !tabName || !rowValues) {
      return res.status(400).json({ error: "Campos obrigatórios: spreadsheetUrl, googleSheetsToken, tabName, rowValues" });
    }

    let spreadsheetId = spreadsheetUrl;
    if (spreadsheetUrl.includes("/d/")) {
      const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      spreadsheetId = match ? match[1] : null;
    }

    if (!spreadsheetId) {
      return res.status(400).json({ error: "URL da Planilha inválida ou não contém ID válido." });
    }

    try {
      // 1. Obter metadados da planilha para verificar abas (sheets)
      console.log(`[Sheets API] Buscando metadados da planilha: ${spreadsheetId}...`);
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: {
          'Authorization': `Bearer ${googleSheetsToken}`,
          'Accept': 'application/json'
        }
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        console.log(`[Google Sheets] Response not OK: status ${metaRes.status}`);
        
        let userMessage = "Erro ao obter metadados da planilha.";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error && parsed.error.message) {
            userMessage = parsed.error.message;
          }
        } catch (e) {}

        if (userMessage.includes("must not be an Office file") || errText.includes("must not be an Office file") || userMessage.includes("not supported for this document")) {
          userMessage = "Planilha incompatível. Utilize Google Sheets convertido.";
        } else if (metaRes.status === 401) {
          userMessage = "Sua sessão do Google Sheets expirou. Por favor, acesse a aba 'Planilhas' e clique em 'Vincular Conta Google' novamente para renovar o acesso.";
        } else if (metaRes.status === 403) {
          if (userMessage.toLowerCase().includes("disabled") || userMessage.toLowerCase().includes("has not been used")) {
            userMessage = "A API do Google Sheets não está ativada no projeto Google Cloud. Por favor, ative a 'Google Sheets API' no console do Google Cloud para este projeto.";
          } else {
            userMessage = "Acesso negado. Certifique-se de que sua conta do Google tem permissão de edição para esta planilha e que ela está compartilhada corretamente.";
          }
        } else if (metaRes.status === 404) {
          userMessage = "Planilha não encontrada. Verifique se a URL da planilha está correta e se ela ainda existe no seu Google Drive.";
        }

        return res.status(metaRes.status).json({ error: userMessage });
      }

      const metaData = await metaRes.json() as any;
      const sheetsList = metaData.sheets || [];
      
      // Buscar aba correspondente - exatamente o nome convertido em minúsculas
      const targetTab = tabName.trim().toLowerCase();
      const foundSheet = sheetsList.find((s: any) => {
        const title = (s.properties?.title || '').trim().toLowerCase();
        return title === targetTab;
      });

      if (!foundSheet) {
        console.warn(`[Sheets API] Aba "${targetTab}" não localizada na planilha.`);
        return res.status(404).json({ 
          error: "Não foi possível localizar a aba selecionada.",
          tabName: targetTab
        });
      }

      // O título exato da aba na planilha
      const exactTitle = foundSheet.properties.title;
      console.log(`[Sheets API] Aba localizada: "${exactTitle}". Inserindo nova linha...`);

      // 2. Inserir nova linha na aba localizada
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(exactTitle)}:append?valueInputOption=USER_ENTERED`;
      const appendRes = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleSheetsToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });

      const appendText = await appendRes.text();
      if (!appendRes.ok) {
        console.log(`[Google Sheets] Append not OK: status ${appendRes.status}`);
        
        let userMessage = "Erro ao inserir nova linha na planilha.";
        try {
          const parsed = JSON.parse(appendText);
          if (parsed.error && parsed.error.message) {
            userMessage = parsed.error.message;
          }
        } catch (e) {}

        if (userMessage.includes("must not be an Office file") || appendText.includes("must not be an Office file") || userMessage.includes("not supported for this document")) {
          userMessage = "Planilha incompatível. Utilize Google Sheets convertido.";
        } else if (appendRes.status === 401) {
          userMessage = "Sua sessão do Google Sheets expirou. Por favor, acesse a aba 'Planilhas' e clique em 'Vincular Conta Google' novamente.";
        } else if (appendRes.status === 403) {
          userMessage = "Acesso negado ao tentar escrever na planilha. Verifique se você tem permissão de editor.";
        } else if (appendRes.status === 404) {
          userMessage = "Não foi possível localizar a aba de destino na planilha.";
        }

        return res.status(appendRes.status).json({ error: userMessage });
      }

      return res.json({ 
        success: true, 
        tabName: exactTitle, 
        responseText: appendText 
      });

    } catch (e: any) {
      console.log("[Google Sheets] Exception:", e.message || e);
      return res.status(500).json({ error: e.message || e });
    }
  });

  // API: Gerar token customizado para login de gestor autorizado com senha master
  app.post("/api/auth/gestor-bypass", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    const emailLower = email.toLowerCase().trim();

    // Lista de e-mails de gestores autorizados
    const allowedGestores = [
      'goncalvesopera@gmail.com',
      'operaformacao@gmail.com', 
      'operaformacar@gmail.com',
      'valiandroopera@gmail.com',
      'lucasgoncalvestributario@gmail.com',
      'valiandrobock@gmail.com',
      'valiandro@gmail.com',
      'opera@goncalves.com',
      'oepra@goncalves.com',
      'opera@gerente.com'
    ];

    if (!allowedGestores.includes(emailLower)) {
      return res.status(403).json({ error: "Este recurso é exclusivo para gestores autorizados." });
    }

    const isNewManager = ['opera@goncalves.com', 'oepra@goncalves.com', 'opera@gerente.com'].includes(emailLower);
    const isValidPassword = isNewManager 
      ? (password === '123456' || password === '010125') 
      : (password === '010125');

    if (!isValidPassword) {
      return res.status(400).json({ error: "Senha inválida para o login de segurança." });
    }

    try {
      // Gerar um UID determinístico para este gestor baseado em seu e-mail
      const safeUid = "gestor_" + emailLower.replace(/[^a-zA-Z0-9]/g, "_");
      console.log(`[Admin Auth] Gerando Custom Token determinístico para gestor ${emailLower} com UID ${safeUid}...`);
      
      const customToken = await admin.auth().createCustomToken(safeUid, {
        email: emailLower,
        role: "gerente"
      });

      console.log(`[Admin Auth] Custom Token gerado com sucesso para ${emailLower}.`);
      return res.json({ success: true, token: customToken });
    } catch (e: any) {
      console.error("[Admin Auth] Erro ao criar custom token:", e);
      return res.status(500).json({ error: `Erro na geração do token: ${e.message || e}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
