import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChatMessage, ChatResponseData } from '@sigma/contracts';

import { ApiError } from '@/api/client';
import { fetchPolicyInfo, sendChat } from '@/api/endpoints';
import { Screen } from '@/components/screen';
import { SigiNote } from '@/components/sigi';
import { copilotSigiState, isCopilotUnavailable } from '@/components/sigi-state';
import { Banner, Card, ChipGroup, Disclosure, ErrorState, LoadingState, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

/** Questions that make sense for any LGU and disease the copilot covers. */
const SUGGESTED = [
  'What should the LGU verify before acting on this signal?',
  'What evidence is missing or unreliable?',
  'Could this signal be explained by incomplete reporting or a backlog?',
];

interface Turn extends ChatMessage {
  /** What the API said about an assistant reply. */
  meta?: Pick<ChatResponseData, 'model' | 'contextScope' | 'limitations'>;
}

interface CopilotError {
  code: string | null;
  message: string;
  question: string;
}

/**
 * Policy.
 *
 * The Policy Copilot comes first: it is what this screen is for. Its AI
 * disclosure sits directly above the input, so nobody sends a question
 * without seeing what the answer is. The prototype assessment areas and the
 * evidence summary follow as collapsible reference sections, kept separate
 * from the copilot because they are a fixed list, not model output.
 */
export default function PolicyScreen() {
  const { baseUrl } = useSettings();
  const theme = useTheme();

  const info = useResource((signal) => fetchPolicyInfo(baseUrl, signal), [baseUrl]);

  const chatScope = info.data?.chatScope ?? [];
  const [disease, setDisease] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const activeDisease = disease ?? chatScope[0]?.disease ?? null;
  const activeScope = chatScope.find((entry) => entry.disease === activeDisease);
  const activeLocation = locationId ?? activeScope?.locationIds[0] ?? null;

  const areaNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of info.data?.areas ?? []) map.set(area.id, area.name);
    return map;
  }, [info.data]);
  const place = activeLocation ? (areaNames.get(activeLocation) ?? activeLocation) : null;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<CopilotError | null>(null);

  const unavailable = isCopilotUnavailable(error?.code ?? null);
  const hasReply = turns.some((turn) => turn.role === 'assistant');
  const ready = Boolean(activeDisease && activeLocation);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !activeDisease || !activeLocation || sending) return;

    setDraft('');
    setError(null);
    setSending(true);
    const history = turns.slice(-10).map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { role: 'user', content: question }]);

    try {
      const response = await sendChat(baseUrl, {
        message: question,
        history,
        disease: activeDisease,
        locationId: activeLocation,
      });
      const { reply, model, contextScope, limitations } = response.data;
      setTurns((current) => [...current, { role: 'assistant', content: reply, meta: { model, contextScope, limitations } }]);
    } catch (caught) {
      setError({
        code: caught instanceof ApiError ? caught.code : null,
        message: caught instanceof ApiError ? caught.message : 'The copilot could not be reached.',
        question,
      });
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    if (!error) return;
    const question = error.question;
    // Drop the unanswered question so it is not sent twice in the history.
    setTurns((current) => (current.at(-1)?.role === 'user' ? current.slice(0, -1) : current));
    void send(question);
  };

  const sigiState = copilotSigiState({ sending, errorCode: error?.code ?? null, draft, hasReply });
  const sigiNote = sending
    ? 'Asking the copilot…'
    : unavailable
      ? 'The copilot is not configured on this server. The reference sections below still work.'
      : error
        ? 'The last request failed. Nothing was generated in its place.'
        : draft.trim().length > 0
          ? 'Listening. Send when your question is ready.'
          : hasReply
            ? 'Answer received. Check it against the evidence before using it.'
            : `Ask about ${place ?? 'an LGU'}: what to verify, what is missing, what the evidence shows.`;

  const refresh = () => info.reload();
  const loading = info.loading && !info.data;
  const failed = info.error && !info.data;

  return (
    <Screen
      title="Policy"
      subtitle="Ask about an LGU's evidence, then check what the answer was based on."
      status={info.meta?.status}
      statusLabel="Demo data"
      onRefresh={refresh}
      refreshing={info.refreshing}>
      {loading ? <LoadingState label="Loading policy context…" /> : null}
      {failed && info.error ? <ErrorState message={info.error.message} onRetry={refresh} /> : null}

      <Card>
        <SectionTitle>Policy Copilot</SectionTitle>

        {chatScope.length > 0 ? (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Disease</Text>
            <ChipGroup
              options={chatScope.map((entry) => ({ value: entry.disease, label: entry.disease }))}
              selected={activeDisease}
              onSelect={(value) => {
                setDisease(value);
                setLocationId(null);
              }}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>LGU</Text>
            <ChipGroup
              options={(activeScope?.locationIds ?? []).map((id) => ({ value: id, label: areaNames.get(id) ?? id }))}
              selected={activeLocation}
              onSelect={setLocationId}
            />
          </>
        ) : !loading ? (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            The copilot needs the policy context. Pull down to reload.
          </Text>
        ) : null}

        <SigiNote state={sigiState} size={64}>
          {sigiNote}
        </SigiNote>

        {turns.length > 0 ? (
          <View style={styles.chatLog} accessibilityLabel="Conversation">
            {turns.map((turn, index) => (
              <View
                key={`${turn.role}-${index}`}
                style={[
                  styles.bubble,
                  turn.role === 'user'
                    ? { backgroundColor: theme.accentSoft, borderColor: theme.accent, alignSelf: 'flex-end' }
                    : { backgroundColor: theme.background, borderColor: theme.border },
                ]}>
                <Text style={[styles.bubbleRole, { color: theme.textSecondary }]}>
                  {turn.role === 'user' ? 'You' : 'Copilot'}
                </Text>
                <Text selectable style={[styles.bubbleText, { color: theme.text }]}>
                  {turn.content}
                </Text>
                {turn.meta ? (
                  <View style={[styles.provenance, { borderTopColor: theme.border }]}>
                    <Text style={[styles.note, { color: theme.textSecondary }]}>Based on: {turn.meta.contextScope}</Text>
                    {turn.meta.limitations.map((line) => (
                      <Text key={line} style={[styles.note, { color: theme.textSecondary }]}>
                        • {line}
                      </Text>
                    ))}
                    <Text style={[styles.note, { color: theme.textSecondary }]}>Model: {turn.meta.model}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Text style={[styles.note, { color: unavailable ? theme.textSecondary : theme.unavailableText }]}>{error.message}</Text>
            {!unavailable ? (
              <Pressable
                accessibilityRole="button"
                onPress={retry}
                hitSlop={8}
                style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.linkText, { color: theme.accent }]}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {turns.length === 0 && !unavailable && ready ? (
          <View style={styles.suggestions}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Suggested questions</Text>
            {SUGGESTED.map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                accessibilityHint="Sends this question to the copilot"
                disabled={sending}
                onPress={() => send(question)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { borderColor: theme.border, backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={[styles.suggestionText, { color: theme.text }]}>{question}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {info.data ? (
          <Banner tone="caution" title="AI disclosure">
            {info.data.scope.aiDisclosure}
          </Banner>
        ) : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Question for the Policy Copilot"
          placeholder={place ? `Ask about ${place}…` : 'Ask a question…'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          multiline
          editable={!sending && !unavailable}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: sending || unavailable || !draft.trim() || !ready, busy: sending }}
          onPress={() => send(draft)}
          disabled={sending || unavailable || !draft.trim() || !ready}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: theme.accent,
              opacity: sending || unavailable || !draft.trim() ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}>
          <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text>
        </Pressable>
      </Card>

      {info.data ? (
        <>
          <Disclosure
            title="Areas for assessment"
            summary={`${info.data.areasForAssessment.length} review prompts · demo data`}>
            {info.data.areasForAssessment.map((insight) => (
              <View key={`${insight.category}-${insight.title}`} style={styles.insight}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>{insight.title}</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>{insight.rationale}</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>
                  Evidence: {insight.evidenceType} ·{' '}
                  {insight.assessmentStatus === 'for-assessment' ? 'For assessment' : 'Monitoring'}
                </Text>
              </View>
            ))}
          </Disclosure>

          <Disclosure title="Evidence summary" summary="What the prototype evidence covers · demo data">
            {info.data.evidenceSummary.map((item) => (
              <Text key={item} style={[styles.note, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </Disclosure>

          <Disclosure title="What SIGMA does not do" summary="Limits that apply to every screen, including the copilot">
            {info.data.whatSigmaDoesNot.map((item) => (
              <Text key={item} style={[styles.note, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </Disclosure>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  insight: {
    gap: 2,
    paddingVertical: Spacing.two,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chatLog: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 4,
    maxWidth: '100%',
  },
  bubbleRole: {
    fontSize: 11,
    fontWeight: '700',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  provenance: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    gap: 2,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  link: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestions: {
    gap: Spacing.two,
  },
  suggestion: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  send: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
