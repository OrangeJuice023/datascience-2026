import { useState } from 'react';
import type { ChatCitation, ChatMessage, ChatResponseData } from '@sigma/contracts';

import { conversationKey, historyForRequest } from '@/api/chat-history';
import { numberCitations, plainReply } from '@/api/citations';
import { ApiError } from '@/api/client';
import { sendChat } from '@/api/endpoints';
import { copilotSigiState, isCopilotUnavailable } from '@/components/sigi-state';

/** SIGI covers dengue only: it is the one disease with real data in SIGMA. */
export const COPILOT_DISEASE = 'Dengue';

export interface CopilotTurn extends ChatMessage {
  /** Assistant turns: what the API said about the reply. */
  meta?: Pick<ChatResponseData, 'model' | 'contextScope' | 'limitations'>;
  /** The reply as plain text with numbered citation markers. */
  display?: string;
  /** Sources in the order of their numbers; only items the server confirmed SIGI was given. */
  citations?: ChatCitation[];
  /** Ids the reply named that SIGI was not given; never shown as sources. */
  rejected?: string[];
}

export interface CopilotError {
  code: string | null;
  message: string;
  question: string;
  /** The conversation the error belongs to; it is not shown in another one. */
  key: string;
}

/**
 * The SIGI conversation for one reporting unit.
 *
 * One conversation per server and unit: changing the unit starts a new one,
 * so a Quezon City exchange is neither shown nor sent for Pasig (the server
 * also refuses history signed for another unit). Only signed, answered
 * exchanges go back as history, so a failed question is never sent twice.
 */
export function useCopilot(baseUrl: string, unitId: string | null) {
  const key = conversationKey(baseUrl, COPILOT_DISEASE, unitId);
  const [conversation, setConversation] = useState<{ key: string; turns: CopilotTurn[] }>({ key, turns: [] });
  const turns = conversation.key === key ? conversation.turns : [];
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lastError, setError] = useState<CopilotError | null>(null);
  const error = lastError?.key === key ? lastError : null;

  const unavailable = isCopilotUnavailable(error?.code ?? null);
  const hasReply = turns.some((turn) => turn.role === 'assistant');

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !unitId || sending) return;

    const requestKey = key;
    setDraft('');
    setError(null);
    setSending(true);
    const history = historyForRequest(turns);
    setConversation((current) => ({
      key: requestKey,
      turns: [...(current.key === requestKey ? current.turns : []), { role: 'user', content: question }],
    }));

    try {
      const response = await sendChat(baseUrl, {
        message: question,
        history,
        disease: COPILOT_DISEASE,
        locationId: unitId,
      });
      const { reply, model, contextScope, limitations, replySignature, citations, rejectedCitationIds } = response.data;
      if (!reply) {
        setError({ code: null, message: 'SIGI returned an empty answer. Nothing was generated in its place.', question, key: requestKey });
        return;
      }
      const numbered = numberCitations(reply, citations ?? []);
      // A reply that arrives after the unit changed is dropped, not shown in the new conversation.
      setConversation((current) =>
        current.key === requestKey
          ? {
              key: requestKey,
              turns: [
                ...current.turns,
                {
                  role: 'assistant',
                  content: reply,
                  signature: replySignature,
                  meta: { model, contextScope, limitations },
                  display: plainReply(numbered.text),
                  citations: numbered.cited,
                  rejected: rejectedCitationIds ?? [],
                },
              ],
            }
          : current
      );
    } catch (caught) {
      setError({
        code: caught instanceof ApiError ? caught.code : null,
        message: caught instanceof ApiError ? caught.message : 'SIGI could not be reached.',
        question,
        key: requestKey,
      });
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    if (!error) return;
    const question = error.question;
    // Drop the unanswered question from the log; send() re-adds it once.
    setConversation((current) =>
      current.key === key && current.turns.at(-1)?.role === 'user'
        ? { key: current.key, turns: current.turns.slice(0, -1) }
        : current
    );
    void send(question);
  };

  const reset = () => {
    setConversation({ key, turns: [] });
    setError(null);
  };

  /** Clears a "not configured" refusal, so SIGI is usable again once the server is configured. */
  const clearError = () => setError(null);

  const sigiState = copilotSigiState({ sending, errorCode: error?.code ?? null, draft, hasReply });

  return { turns, draft, setDraft, sending, error, unavailable, hasReply, send, retry, reset, clearError, sigiState };
}

export type Copilot = ReturnType<typeof useCopilot>;
