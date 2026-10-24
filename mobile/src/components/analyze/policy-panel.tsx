import type { ChatCitation } from '@sigma/contracts';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isWebUrl } from '@/api/citations';
import { SigiNote } from '@/components/sigi';
import { Banner, Card, Disclosure, SectionTitle } from '@/components/ui';
import { UnitPicker } from '@/components/unit-picker';
import { Spacing } from '@/constants/theme';
import type { Copilot, CopilotTurn } from '@/hooks/use-copilot';
import { useTheme } from '@/hooks/use-theme';

const KIND_LABEL: Record<ChatCitation['kind'], string> = {
  lab: 'Lab',
  access: 'ACCESS',
  policy: 'Policy',
  method: 'Method',
};

/** Starter questions SIGI can answer for any reporting unit; none implies live data or stock. Same set as the web app. */
function suggestions(place: string): { label: string; questions: string[] }[] {
  return [
    {
      label: 'Understand the data',
      questions: [
        `What does the dengue record for ${place} show from 2016 to 2020?`,
        'Which weeks are missing or questionable, and why does that matter?',
      ],
    },
    {
      label: 'Investigate signals',
      questions: [
        'Did EARS flag a rise before the DOH threshold was crossed in 2019?',
        'What should I verify before reading an EARS alarm as a real increase?',
      ],
    },
    {
      label: 'Explore access',
      questions: [
        `What hospitals and pharmacies are mapped in ${place}, and what can't that tell us?`,
        'What do dengue IV fluids and paracetamol cost public hospitals?',
      ],
    },
  ];
}

/**
 * Policy: SIGI, for the selected reporting unit. The disclosure sits above
 * the input, every answer lists the evidence it cites as numbered sources,
 * and anything SIGI named that it was not given is marked unsupported.
 */
export function PolicyPanel({ copilot, place }: { copilot: Copilot; place: string | null }) {
  const theme = useTheme();
  const { turns, draft, setDraft, sending, error, unavailable, hasReply, send, retry, reset, sigiState } = copilot;
  const ready = place !== null;

  const sigiNote = sending
    ? 'SIGI is reading the evidence…'
    : unavailable
      ? 'SIGI is not configured on this server, so there is no answer to show.'
      : error
        ? 'The last request failed. Nothing was generated in its place.'
        : draft.trim().length > 0
          ? 'Listening. Send when your question is ready.'
          : hasReply
            ? 'Answer received. Check it against its sources before using it.'
            : `Ask about ${place ?? 'a reporting unit'}: what the record shows, what is missing, what to check.`;

  const canSend = ready && !sending && !unavailable && draft.trim().length > 0;

  return (
    <>
      <UnitPicker hint="Opens the list of reporting units. Changing the unit starts a new conversation." />

      <Card>
        <SectionTitle
          action={
            turns.length > 0 || error ? (
              <Pressable
                accessibilityRole="button"
                onPress={reset}
                hitSlop={8}
                style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.textButtonLabel, { color: theme.accent }]}>New conversation</Text>
              </Pressable>
            ) : null
          }>
          Ask SIGI
        </SectionTitle>

        <SigiNote state={sigiState} size={64}>
          {sigiNote}
        </SigiNote>

        {turns.length > 0 ? (
          <View style={styles.chatLog} accessibilityLabel="Conversation">
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <View
                  key={`user-${index}`}
                  style={[styles.bubble, styles.userBubble, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                  <Text style={[styles.bubbleRole, { color: theme.textSecondary }]}>You</Text>
                  <Text selectable style={[styles.bubbleText, { color: theme.text }]}>
                    {turn.content}
                  </Text>
                </View>
              ) : (
                <AnswerBubble key={`assistant-${index}`} turn={turn} />
              )
            )}
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Text style={[styles.note, { color: unavailable ? theme.textSecondary : theme.unavailableText }]}>
              {error.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              hitSlop={8}
              style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[styles.textButtonLabel, { color: theme.accent }]}>{unavailable ? 'Check again' : 'Try again'}</Text>
            </Pressable>
          </View>
        ) : null}

        {turns.length === 0 && !unavailable && place ? (
          <View style={styles.suggestions}>
            {suggestions(place).map((group) => (
              <View key={group.label} style={styles.suggestionGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{group.label}</Text>
                {group.questions.map((question) => (
                  <Pressable
                    key={question}
                    accessibilityRole="button"
                    accessibilityHint="Sends this question to SIGI"
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
            ))}
          </View>
        ) : null}

        <Banner tone="caution" title="AI-generated answers">
          SIGI answers from SIGMA&apos;s Lab, ACCESS and Policy evidence for {place ?? 'the selected unit'} and lists
          what it used. It can be wrong: check each source before using an answer. It does not declare outbreaks,
          know current case counts or medicine stock, or make decisions for you.
        </Banner>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          accessibilityLabel="Question for SIGI"
          accessibilityHint={place ? `About ${place}` : undefined}
          placeholder={place ? `Ask about ${place}…` : 'Ask a question…'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          multiline
          maxLength={2000}
          editable={!sending && !unavailable}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          onPress={() => send(draft)}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: theme.text, opacity: !canSend ? 0.45 : pressed ? 0.8 : 1 },
          ]}>
          <Text style={[styles.sendText, { color: theme.background }]}>{sending ? 'Sending…' : 'Send'}</Text>
        </Pressable>
      </Card>
    </>
  );
}

function AnswerBubble({ turn }: { turn: CopilotTurn }) {
  const theme = useTheme();
  const citations = turn.citations ?? [];
  const rejected = turn.rejected ?? [];
  return (
    <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Text style={[styles.bubbleRole, { color: theme.textSecondary }]}>SIGI · AI-generated</Text>
      <Text selectable style={[styles.bubbleText, { color: theme.text }]}>
        {turn.display ?? turn.content}
      </Text>
      {turn.meta ? (
        <View style={[styles.provenance, { borderTopColor: theme.border }]}>
          {citations.length > 0 ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondaryStrong, marginTop: 0 }]}>Sources</Text>
              {citations.map((citation, n) => (
                <SourceRow key={citation.id} n={n + 1} citation={citation} />
              ))}
            </>
          ) : (
            <Text style={[styles.note, { color: theme.textSecondary }]}>
              This answer cites none of the evidence SIGI was given, so treat it as unsupported.
            </Text>
          )}
          {rejected.length > 0 ? (
            <View style={[styles.unsupported, { backgroundColor: `${theme.demo}14`, borderColor: `${theme.demo}55` }]}>
              <Text style={[styles.note, { color: theme.text }]}>
                Unsupported: SIGI referred to evidence it was not given for this unit ({rejected.join(', ')}). Those
                parts of the answer are not backed by a source and are not listed above.
              </Text>
            </View>
          ) : null}
          <Text style={[styles.note, { color: theme.textSecondary }]}>Based on: {turn.meta.contextScope}</Text>
          <Disclosure title="Limitations" summary={`Model ${turn.meta.model}`}>
            {turn.meta.limitations.map((line) => (
              <Text key={line} style={[styles.note, { color: theme.textSecondary }]}>
                • {line}
              </Text>
            ))}
          </Disclosure>
        </View>
      ) : null}
    </View>
  );
}

function SourceRow({ n, citation }: { n: number; citation: ChatCitation }) {
  const theme = useTheme();
  const url = citation.source.url;
  return (
    <View style={styles.source} accessible={!isWebUrl(url)} accessibilityLabel={`Source ${n}: ${citation.title}, ${citation.source.name}`}>
      <Text style={[styles.sourceNumber, { color: theme.liveText, backgroundColor: theme.accentSoft }]}>{n}</Text>
      <View style={styles.sourceText}>
        <Text style={[styles.sourceTitle, { color: theme.text }]}>{citation.title}</Text>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          {KIND_LABEL[citation.kind]} · {citation.jurisdiction} · {citation.source.name}
        </Text>
        {isWebUrl(url) ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open source ${n}: ${citation.source.name}`}
            onPress={() => {
              void Linking.openURL(url).catch(() => undefined);
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.textButtonLabel, { color: theme.accent }]}>Open source</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  userBubble: {
    alignSelf: 'flex-end',
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
    gap: Spacing.two,
  },
  source: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  sourceNumber: {
    minWidth: 24,
    textAlign: 'center',
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
  },
  sourceText: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  unsupported: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  textButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestions: {
    gap: Spacing.two,
  },
  suggestionGroup: {
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
    fontWeight: '600',
    fontSize: 16,
  },
});
