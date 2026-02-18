import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ParsedAiResponse {
  message: string;
  quickReplies: string[];
  suggestedProfessions: SuggestedProfession[] | null;
  isComplete: boolean;
}

export interface SuggestedProfession {
  id: string | null;
  name: string;
  matchPercent: number;
  shortDescription: string | null;
  salaryYear1: number | null;
  salaryYear2: number | null;
  salaryYear3: number | null;
  reason: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn(
        'OPENAI_API_KEY ist nicht gesetzt. KI-Antworten werden simuliert.',
      );
    }
  }

  // ─── PORTAL CONFIG ─────────────────────────────────────────────────────────

  private getPortalConfig(portal?: string) {
    const configs: Record<string, { name: string; jobType: string; jobTypePlural: string; target: string; finderName: string }> = {
      werkstudentengenie: {
        name: 'Werkstudentengenie',
        jobType: 'Werkstudentenstelle',
        jobTypePlural: 'Werkstudentenstellen',
        target: 'Studierende',
        finderName: 'Werkstudentengenie-Jobfinder',
      },
      ausbildungsgenie: {
        name: 'Ausbildungsgenie',
        jobType: 'Ausbildungsberuf',
        jobTypePlural: 'Ausbildungsberufe',
        target: 'Jugendliche und Schulabgänger',
        finderName: 'Ausbildungsgenie-Berufsfinder',
      },
      berufsgenie: {
        name: 'Berufsgenie',
        jobType: 'Job',
        jobTypePlural: 'Jobs',
        target: 'Berufssuchende',
        finderName: 'Berufsgenie-Jobfinder',
      },
      praktikumsgenie: {
        name: 'Praktikumsgenie',
        jobType: 'Praktikum',
        jobTypePlural: 'Praktika',
        target: 'Schüler und Studierende',
        finderName: 'Praktikumsgenie-Praktikumsfinder',
      },
      minijobgenie: {
        name: 'Minijobgenie',
        jobType: 'Minijob',
        jobTypePlural: 'Minijobs',
        target: 'Schüler, Studierende und Nebenjobber',
        finderName: 'Minijobgenie-Jobfinder',
      },
    };
    return configs[portal || ''] || configs['ausbildungsgenie'];
  }

  // ─── START CONVERSATION ─────────────────────────────────────────────────────

  async startConversation(userId?: string, sessionId?: string, portal?: string) {
    const portalConfig = this.getPortalConfig(portal);

    const greeting =
      `Hey! Willkommen beim ${portalConfig.finderName}! ` +
      `Ich helfe dir, ${portalConfig.jobType === 'Ausbildungsberuf' ? 'den perfekten Ausbildungsberuf' : portalConfig.jobType === 'Praktikum' ? 'das perfekte Praktikum' : `den perfekten ${portalConfig.jobType}`} zu finden. ` +
      'Erzähl mir doch mal: Was machst du so in deiner Freizeit?';

    const quickReplies = [
      'Sport & Fitness',
      'Zocken & Technik',
      'Kreativ sein (Zeichnen, Musik...)',
      'Draußen in der Natur',
      'Mit Freunden chillen',
    ];

    const initialAssistantMessage = {
      role: 'assistant' as const,
      content: this.formatAiOutput(greeting, quickReplies, null),
    };

    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId: userId || null,
        sessionId: sessionId || null,
        portal: portal || null,
        messages: [initialAssistantMessage] as any,
        questionCount: 1,
        completed: false,
      },
    });

    return {
      conversationId: conversation.id,
      response: {
        message: greeting,
        quickReplies,
      },
      suggestedProfessions: null,
      isComplete: false,
    };
  }

  // ─── CHAT ───────────────────────────────────────────────────────────────────

  async chat(conversationId: string, message: string, userId?: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Konversation nicht gefunden');
    }

    // Append user message
    const messages = (conversation.messages as unknown as AiMessage[]) || [];
    messages.push({ role: 'user', content: message });

    const newQuestionCount = conversation.questionCount + 1;

    // Get AI response
    const parsed = await this.getAiResponse(messages, newQuestionCount, conversation.portal || undefined);

    // Append assistant message
    messages.push({
      role: 'assistant',
      content: this.formatAiOutput(
        parsed.message,
        parsed.quickReplies,
        parsed.suggestedProfessions,
      ),
    });

    // Update conversation
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        messages: messages as any,
        questionCount: newQuestionCount,
        completed: parsed.isComplete,
        suggestedProfessions: parsed.suggestedProfessions
          ? (parsed.suggestedProfessions as any)
          : undefined,
      },
    });

    return {
      conversationId,
      response: {
        message: parsed.message,
        quickReplies: parsed.quickReplies,
      },
      suggestedProfessions: parsed.suggestedProfessions,
      isComplete: parsed.isComplete,
    };
  }

  // ─── GET CONVERSATION ───────────────────────────────────────────────────────

  async getConversation(conversationId: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Konversation nicht gefunden');
    }

    // Parse stored messages into a clean format
    const messages = (conversation.messages as unknown as AiMessage[]) || [];
    const parsedMessages = messages.map((msg) => {
      if (msg.role === 'assistant') {
        const parsed = this.parseStoredAiOutput(msg.content);
        return {
          role: msg.role,
          message: parsed.message,
          quickReplies: parsed.quickReplies,
          suggestedProfessions: parsed.suggestedProfessions,
        };
      }
      return { role: msg.role, message: msg.content };
    });

    return {
      id: conversation.id,
      userId: conversation.userId,
      sessionId: conversation.sessionId,
      messages: parsedMessages,
      suggestedProfessions: conversation.suggestedProfessions,
      completed: conversation.completed,
      questionCount: conversation.questionCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  // ─── APPLY SUGGESTIONS ────────────────────────────────────────────────────

  async applySuggestions(
    userId: string,
    conversationId: string,
    professionIds: string[],
  ) {
    // Verify conversation exists and has suggestions
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Konversation nicht gefunden');
    }

    // Get valid profession IDs
    const validProfessions = await this.prisma.profession.findMany({
      where: {
        id: { in: professionIds },
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (validProfessions.length === 0) {
      return { applied: false, message: 'Keine gueltigen Berufe gefunden' };
    }

    const validIds = validProfessions.map((p) => p.id);

    // Update user's preferred professions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredProfessions: true },
    });

    let existing: string[] = [];
    if (user?.preferredProfessions) {
      try {
        const parsed = typeof user.preferredProfessions === 'string'
          ? JSON.parse(user.preferredProfessions)
          : user.preferredProfessions;
        if (Array.isArray(parsed)) {
          existing = parsed.filter((p: any) => typeof p === 'string');
        }
      } catch {
        existing = [];
      }
    }

    // Merge without duplicates
    const merged = [...new Set([...existing, ...validIds])];

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferredProfessions: merged,
      },
    });

    return {
      applied: true,
      professions: validProfessions,
      totalPreferred: merged.length,
    };
  }

  // ─── PRIVATE: GET AI RESPONSE ───────────────────────────────────────────────

  private async getAiResponse(
    messages: AiMessage[],
    questionCount: number,
    portal?: string,
  ): Promise<ParsedAiResponse> {
    if (!this.openai) {
      return this.getMockResponse(questionCount);
    }

    try {
      const systemPrompt = await this.buildSystemPrompt(questionCount, portal);

      // Build OpenAI messages array with system prompt first
      const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.role === 'assistant' ? this.extractPlainMessage(msg.content) : msg.content,
        })),
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: openaiMessages,
        response_format: { type: 'json_object' },
      });

      const rawText = response.choices[0]?.message?.content || '';

      return await this.parseAiResponse(rawText, questionCount);
    } catch (error) {
      this.logger.error('Fehler bei der OpenAI API-Anfrage', error);
      return this.getMockResponse(questionCount);
    }
  }

  // ─── PRIVATE: BUILD SYSTEM PROMPT ───────────────────────────────────────────

  private async buildSystemPrompt(questionCount: number, portal?: string): Promise<string> {
    const portalConfig = this.getPortalConfig(portal);

    // Load all active professions for context
    const professions = await this.prisma.profession.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        shortDescription: true,
        salaryYear1: true,
        salaryYear2: true,
        salaryYear3: true,
        skills: true,
        tasks: true,
        requirements: true,
      },
      orderBy: { name: 'asc' },
    });

    const professionList = professions
      .map(
        (p) =>
          `- ${p.name} (ID: ${p.id}, Kategorie: ${p.category || 'k.A.'}, ` +
          `Gehalt 1. Jahr: ${p.salaryYear1 || 'k.A.'}EUR, ` +
          `2. Jahr: ${p.salaryYear2 || 'k.A.'}EUR, ` +
          `3. Jahr: ${p.salaryYear3 || 'k.A.'}EUR): ` +
          `${p.shortDescription || 'Keine Beschreibung'}`,
      )
      .join('\n');

    const shouldSuggest = questionCount >= 5;

    return `Du bist der ${portalConfig.finderName}, ein freundlicher KI-Assistent auf ${portalConfig.name}, der ${portalConfig.target} hilft, ${portalConfig.jobType === 'Ausbildungsberuf' ? 'den passenden Ausbildungsberuf' : portalConfig.jobType === 'Praktikum' ? 'das passende Praktikum' : `den passenden ${portalConfig.jobType}`} zu finden.

PORTAL-KONTEXT:
- Du bist auf ${portalConfig.name} (Portal für ${portalConfig.jobTypePlural})
- Zielgruppe: ${portalConfig.target}
- Stellentyp: ${portalConfig.jobTypePlural}
- Passe deine Fragen und Empfehlungen an diesen Kontext an

DEINE PERSOENLICHKEIT:
- Freundlich und locker (Du, nicht Sie)
- Sprichst wie ein cooler aelterer Freund/Mentor
- Kurze Nachrichten (max 2-3 Saetze)
- Verwende Emojis sparsam aber passend

ABLAUF:
- Frag nach Interessen, Hobbys, Staerken, Schulfaechern, Vorlieben
- Stelle immer nur EINE Frage pro Nachricht
- Aktuelle Frage-Nummer: ${questionCount}
${shouldSuggest ? `- WICHTIG: Du hast genug Informationen gesammelt. Schlage jetzt 3-5 passende ${portalConfig.jobTypePlural} vor!` : `- Sammle noch mehr Informationen (Ziel: 5-7 Fragen bevor du ${portalConfig.jobTypePlural} vorschlaegst)`}

VERFUEGBARE BERUFE/BRANCHEN:
${professionList}

ANTWORT-FORMAT:
Antworte IMMER in folgendem JSON-Format (NUR das JSON, kein anderer Text):

${
  shouldSuggest
    ? `{
  "message": "Deine Nachricht an den User",
  "quickReplies": ["Option 1", "Option 2", "Option 3"],
  "suggestedProfessions": [
    {
      "name": "Berufsname",
      "id": "die-uuid-aus-der-liste-oder-null",
      "matchPercent": 85,
      "reason": "Kurze Begruendung warum dieser ${portalConfig.jobType} passt"
    }
  ],
  "isComplete": true
}`
    : `{
  "message": "Deine Nachricht an den User",
  "quickReplies": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "suggestedProfessions": null,
  "isComplete": false
}`
}

WICHTIG:
- quickReplies muessen IMMER 3-5 klickbare Antwort-Optionen enthalten
- Bei Berufsvorschlaegen: Nenne Match-Prozent (60-95%) und verwende NUR Berufe aus der obigen Liste
- Verwende die echte ID aus der Berufsliste wenn moeglich
- Antworte AUSSCHLIESSLICH mit validem JSON, kein Markdown, kein sonstiger Text`;
  }

  // ─── PRIVATE: PARSE AI RESPONSE ────────────────────────────────────────────

  private async parseAiResponse(
    rawText: string,
    questionCount: number,
  ): Promise<ParsedAiResponse> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Keine JSON-Struktur in AI-Antwort gefunden');
        return this.fallbackParse(rawText, questionCount);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const message =
        typeof parsed.message === 'string'
          ? parsed.message
          : 'Hmm, da ist was schiefgelaufen. Erzaehl mir nochmal mehr ueber dich!';

      const quickReplies = Array.isArray(parsed.quickReplies)
        ? parsed.quickReplies.filter(
            (r: any) => typeof r === 'string' && r.length > 0,
          )
        : ['Weiter', 'Andere Frage', 'Nochmal von vorne'];

      let suggestedProfessions: SuggestedProfession[] | null = null;
      if (Array.isArray(parsed.suggestedProfessions) && parsed.suggestedProfessions.length > 0) {
        suggestedProfessions = parsed.suggestedProfessions.map((p: any) => ({
          id: p.id || null,
          name: p.name || 'Unbekannter Beruf',
          matchPercent: typeof p.matchPercent === 'number' ? p.matchPercent : 70,
          shortDescription: p.shortDescription || null,
          salaryYear1: p.salaryYear1 || null,
          salaryYear2: p.salaryYear2 || null,
          salaryYear3: p.salaryYear3 || null,
          reason: p.reason || '',
        }));

        // Enrich with DB data where we have IDs
        suggestedProfessions = await this.enrichProfessions(suggestedProfessions!);
      }

      const isComplete =
        parsed.isComplete === true ||
        (suggestedProfessions !== null && suggestedProfessions.length > 0);

      return { message, quickReplies, suggestedProfessions, isComplete };
    } catch (error) {
      this.logger.warn('Fehler beim Parsen der AI-Antwort', error);
      return this.fallbackParse(rawText, questionCount);
    }
  }

  private fallbackParse(
    rawText: string,
    questionCount: number,
  ): ParsedAiResponse {
    // Use the raw text as message and provide contextual quick replies
    const cleanText = rawText
      .replace(/```json?\s*/g, '')
      .replace(/```/g, '')
      .trim();

    const fallbackReplies: string[][] = [
      ['Sport & Fitness', 'Zocken & Technik', 'Kreativ sein', 'Draussen in der Natur', 'Mit Freunden chillen'],
      ['Logisches Denken', 'Kreativitaet', 'Mit Menschen reden', 'Handwerkliches Geschick', 'Organisation'],
      ['Mathe & Physik', 'Deutsch & Sprachen', 'Kunst & Musik', 'Bio & Chemie', 'Sport'],
      ['Am Computer arbeiten', 'Draussen unterwegs sein', 'Mit Menschen arbeiten', 'In einer Werkstatt/Labor', 'Im Buero organisieren'],
      ['Gutes Gehalt', 'Abwechslung', 'Teamarbeit', 'Selbststaendigkeit', 'Karrierechancen'],
    ];

    const idx = Math.min(Math.max(questionCount - 1, 0), fallbackReplies.length - 1);

    return {
      message:
        cleanText || 'Erzaehl mir mehr ueber dich! Was interessiert dich?',
      quickReplies: fallbackReplies[idx],
      suggestedProfessions: null,
      isComplete: false,
    };
  }

  // ─── PRIVATE: ENRICH PROFESSIONS ───────────────────────────────────────────

  private async enrichProfessions(
    professions: SuggestedProfession[],
  ): Promise<SuggestedProfession[]> {
    const enriched: SuggestedProfession[] = [];

    for (const prof of professions) {
      if (prof.id) {
        try {
          const dbProf = await this.prisma.profession.findUnique({
            where: { id: prof.id },
            select: {
              id: true,
              name: true,
              shortDescription: true,
              salaryYear1: true,
              salaryYear2: true,
              salaryYear3: true,
            },
          });

          if (dbProf) {
            enriched.push({
              ...prof,
              name: dbProf.name,
              shortDescription: dbProf.shortDescription,
              salaryYear1: dbProf.salaryYear1,
              salaryYear2: dbProf.salaryYear2,
              salaryYear3: dbProf.salaryYear3,
            });
            continue;
          }
        } catch {
          // Fall through to unenriched push
        }
      }

      // Try to find by name if no ID or ID lookup failed
      try {
        const dbProf = await this.prisma.profession.findFirst({
          where: {
            name: { contains: prof.name },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            shortDescription: true,
            salaryYear1: true,
            salaryYear2: true,
            salaryYear3: true,
          },
        });

        if (dbProf) {
          enriched.push({
            ...prof,
            id: dbProf.id,
            name: dbProf.name,
            shortDescription: dbProf.shortDescription,
            salaryYear1: dbProf.salaryYear1,
            salaryYear2: dbProf.salaryYear2,
            salaryYear3: dbProf.salaryYear3,
          });
          continue;
        }
      } catch {
        // Fall through
      }

      enriched.push(prof);
    }

    return enriched;
  }

  // ─── PRIVATE: MOCK RESPONSE ─────────────────────────────────────────────────

  private getMockResponse(questionCount: number): ParsedAiResponse {
    if (questionCount >= 6) {
      return {
        message:
          'Super, jetzt hab ich ein gutes Bild von dir! Hier sind meine Top-Vorschlaege fuer dich:',
        quickReplies: [
          'Mehr ueber Beruf 1 erfahren',
          'Mehr ueber Beruf 2 erfahren',
          'Nochmal von vorne',
        ],
        suggestedProfessions: [
          {
            id: null,
            name: 'Fachinformatiker/in Anwendungsentwicklung',
            matchPercent: 92,
            shortDescription:
              'Entwicklung und Programmierung von Softwareloesungen',
            salaryYear1: 1050,
            salaryYear2: 1150,
            salaryYear3: 1250,
            reason: 'Passt super zu deinem Interesse an Technik und Logik!',
          },
          {
            id: null,
            name: 'Mediengestalter/in Digital und Print',
            matchPercent: 78,
            shortDescription: 'Gestaltung von digitalen und gedruckten Medien',
            salaryYear1: 950,
            salaryYear2: 1050,
            salaryYear3: 1150,
            reason: 'Deine kreative Seite kommt hier voll zur Geltung!',
          },
          {
            id: null,
            name: 'Kaufmann/frau fuer E-Commerce',
            matchPercent: 71,
            shortDescription: 'Online-Handel und digitales Marketing',
            salaryYear1: 1000,
            salaryYear2: 1100,
            salaryYear3: 1200,
            reason: 'Verbindet Technik mit kaufmaennischem Denken.',
          },
        ],
        isComplete: true,
      };
    }

    const mockResponses: { message: string; quickReplies: string[] }[] = [
      {
        message:
          'Nice! Und was wuerdest du sagen, wo deine Staerken liegen?',
        quickReplies: [
          'Logisches Denken',
          'Kreativitaet',
          'Mit Menschen reden',
          'Handwerkliches Geschick',
          'Organisation',
        ],
      },
      {
        message:
          'Cool! Welche Schulfaecher machen dir am meisten Spass?',
        quickReplies: [
          'Mathe & Physik',
          'Deutsch & Sprachen',
          'Kunst & Musik',
          'Bio & Chemie',
          'Sport',
        ],
      },
      {
        message:
          'Gut zu wissen! Wie stellst du dir deinen idealen Arbeitstag vor?',
        quickReplies: [
          'Am Computer arbeiten',
          'Draussen unterwegs sein',
          'Mit Menschen arbeiten',
          'In einer Werkstatt/Labor',
          'Im Buero organisieren',
        ],
      },
      {
        message: 'Spannend! Was ist dir bei einem Job am wichtigsten?',
        quickReplies: [
          'Gutes Gehalt',
          'Abwechslung',
          'Teamarbeit',
          'Selbststaendigkeit',
          'Karrierechancen',
        ],
      },
      {
        message:
          'Fast geschafft! Koenntest du dir vorstellen, eher koerperlich oder eher geistig zu arbeiten?',
        quickReplies: [
          'Eher koerperlich',
          'Eher geistig',
          'Eine Mischung',
          'Ist mir egal',
        ],
      },
    ];

    const idx = Math.min(questionCount - 1, mockResponses.length - 1);
    const mock = mockResponses[idx];

    return {
      message: mock.message,
      quickReplies: mock.quickReplies,
      suggestedProfessions: null,
      isComplete: false,
    };
  }

  // ─── PRIVATE: FORMAT/PARSE HELPERS ──────────────────────────────────────────

  /**
   * Format AI output for storage in the messages JSON field.
   * We store a JSON string so we can reconstruct quick replies and suggestions.
   */
  private formatAiOutput(
    message: string,
    quickReplies: string[],
    suggestedProfessions: SuggestedProfession[] | null,
  ): string {
    return JSON.stringify({ message, quickReplies, suggestedProfessions });
  }

  /**
   * Parse stored assistant message content back into structured data.
   */
  private parseStoredAiOutput(content: string): {
    message: string;
    quickReplies: string[];
    suggestedProfessions: SuggestedProfession[] | null;
  } {
    try {
      const parsed = JSON.parse(content);
      return {
        message: parsed.message || content,
        quickReplies: parsed.quickReplies || [],
        suggestedProfessions: parsed.suggestedProfessions || null,
      };
    } catch {
      return { message: content, quickReplies: [], suggestedProfessions: null };
    }
  }

  /**
   * Extract plain message text from a stored assistant message.
   * Used when building the conversation history for the Claude API.
   */
  private extractPlainMessage(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return parsed.message || content;
    } catch {
      return content;
    }
  }
}
