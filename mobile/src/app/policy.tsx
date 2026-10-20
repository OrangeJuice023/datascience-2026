import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChatMessage } from '@sigma/contracts';

import { ApiError } from '@/api/client';
import { fetchPolicyInfo, sendChat } from '@/api/endpoints';
import { Screen } from '@/components/screen';
import { SigiNote } from '@/components/sigi';
import { Banner, Card, ChipGroup, ErrorState, LoadingState, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useResource } from '@/hooks/use-resource';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings-context';

/**
 * Policy.
 *
 * Two separate things, kept separate on purpose:
 *
 * 1. The assessment areas and the evidence summary, which are a fixed
 *    prototype list built on simulated data.
 * 2. The Policy Copilot, which is a model over that same simulated data.
 *
 * The copilot's disclosure is shown above the input, not buried below the
 * reply, so nobody sends a question without seeing what the answer is.
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState<string | null>(null);

  const submit = async () => {
    const message = draft.trim();
    if (!message || !activeDisease || !activeLocation) return;

    setDraft('');
    setChatError(null);
    setSending(true);
    const history = messages.slice(-10);
    setMessages((current) => [...current, { role: 'user', content: message }]);

    try {
      const response = await sendChat(baseUrl, {
        message,
        history,
        disease: activeDisease,
        locationId: activeLocation,
      });
      setMessages((current) => [...current, { role: 'assistant', content: response.data.reply }]);
      setDisclosure(response.data.contextScope);
    } catch (error) {
      const text =
        error instanceof ApiError
          ? error.message
          : 'The copilot could not be reached.';
      setChatError(text);
    } finally {
      setSending(false);
    }
  };

  const refresh = () => info.reload();

  const loading = info.loading && !info.data;
  const failed = info.error && !info.data;

  /**
   * Sigi follows the copilot, not the epidemiology: listening while the
   * question is being written, thinking while the request is in flight,
   * responding once an answer is on screen, concerned when the request
   * failed.
   */
  const sigiState = sending
    ? 'thinking'
    : chatError
      ? 'error'
      : draft.trim().length > 0
        ? 'listening'
        : messages.length > 0
          ? 'responding'
          : 'idle';

  const sigiNote = sending
    ? 'Sigi is waiting for the copilot. The answer will be generated over demo evidence.'
    : chatError
      ? 'Sigi could not reach the copilot. Nothing was invented in its place.'
      : draft.trim().length > 0
        ? 'Sigi is listening while you write the question.'
        : messages.length > 0
          ? 'Sigi is showing the last reply. The copilot speaks for itself, not for the government.'
          : 'Sigi is waiting. Ask about the evidence, the gaps, or what the LGU should verify.';

  return (
    <Screen
      title="Policy"
      subtitle="Areas for human assessment, and a copilot over the same evidence."
      status={info.meta?.status}
      statusLabel="Demo data"
      onRefresh={refresh}
      refreshing={info.refreshing}>
      {loading ? <LoadingState label="Loading policy context…" /> : null}
      {failed && info.error ? (
        <ErrorState message={info.error.message} onRetry={refresh} />
      ) : null}

      {info.data ? (
        <>
          <Banner tone="caution" title="AI disclosure">
            {info.data.scope.aiDisclosure}
          </Banner>

          <Card>
            <SectionTitle>Areas for assessment</SectionTitle>
            {info.data.areasForAssessment.map((insight) => (
              <View key={`${insight.category}-${insight.title}`} style={styles.insight}>
                <Text style={[styles.insightTitle, { color: theme.text }]}>{insight.title}</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>{insight.rationale}</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>
                  Evidence: {insight.evidenceType} · {insight.assessmentStatus === 'for-assessment' ? 'For assessment' : 'Monitoring'}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <SectionTitle>Evidence summary</SectionTitle>
            {info.data.evidenceSummary.map((item) => (
              <Text key={item} style={[styles.bullet, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </Card>

          <Card>
            <SectionTitle>What SIGMA does not do</SectionTitle>
            {info.data.whatSigmaDoesNot.map((item) => (
              <Text key={item} style={[styles.bullet, { color: theme.textSecondary }]}>
                • {item}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

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
            <Text style={[styles.label, { color: theme.textSecondary }]}>Location</Text>
            <ChipGroup
              options={(activeScope?.locationIds ?? []).map((id) => ({
                value: id,
                label: areaNames.get(id) ?? id,
              }))}
              selected={activeLocation}
              onSelect={setLocationId}
            />
          </>
        ) : (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            The copilot needs the policy context to be loaded first.
          </Text>
        )}

        <SigiNote state={sigiState} size={48}>
          {sigiNote}
        </SigiNote>

        <View style={styles.chatLog}>
          {messages.map((message, index) => (
            <View
              key={`${message.role}-${index}`}
              style={[
                styles.bubble,
                message.role === 'user'
                  ? { backgroundColor: theme.accentSoft, borderColor: theme.accent }
                  : { backgroundColor: theme.background, borderColor: theme.border },
              ]}>
              <Text style={[styles.bubbleRole, { color: theme.textSecondary }]}>
                {message.role === 'user' ? 'You' : 'Copilot'}
              </Text>
              <Text style={[styles.bubbleText, { color: theme.text }]}>{message.content}</Text>
            </View>
          ))}
          {sending ? <ActivityIndicator color={theme.accent} style={styles.spinner} /> : null}
        </View>

        {chatError ? (
            <Text style={[styles.errorText, { color: theme.unavailableText }]}>{chatError}</Text>
        ) : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a question about this disease and location"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
          multiline
          editable={!sending}
        />

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={sending || !draft.trim() || !activeDisease || !activeLocation}
          style={[
            styles.send,
            { backgroundColor: theme.accent, opacity: sending || !draft.trim() ? 0.5 : 1 },
          ]}>
          <Text style={styles.sendText}>{sending ? 'Asking…' : 'Ask the copilot'}</Text>
        </Pressable>

        {disclosure ? (
          <Text style={[styles.note, { color: theme.textSecondary }]}>Context given to the model: {disclosure}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    lineHeight: 19,
  },
  bullet: {
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    marginTop: Spacing.three,
  },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.two,
    gap: 2,
  },
  bubbleRole: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.two,
    fontSize: 14,
    minHeight: 72,
    marginTop: Spacing.two,
    textAlignVertical: 'top',
  },
  send: {
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
