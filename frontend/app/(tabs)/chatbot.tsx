// Chatbot — "Asistanım" — Türkçe kayıt asistanı (theme-aware).
// - Kayıt yolu: yalnızca burası. FAB + tüm hızlı-eylemler buraya gelir.
// - Belirsizlik durumunda 2 çoktan seçmeli soru + "Manuel gir" seçeneği.
// - Kısayol butonları: 1 bardak su / spor kaydet / öğün ekle.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { RADIUS, SPACING, getThemed } from "@/src/theme";
import { useAuth } from "@/src/auth-context";
import { api } from "@/src/api";
import { istanbulNowISO } from "@/src/utils/time";
import { ManualFoodModal } from "@/src/components/ManualFoodModal";

interface Question {
  id: string;
  question: string;
  options: string[];
}
interface Msg {
  role: "user" | "bot";
  text: string;
  entry?: any;
  showCta?: boolean; // "Takvime git" + "Başka kayıt ekle" buttons after a successful entry
  clarification?: {
    questions: Question[];
    draft: any;
    originalMessage: string;
    answered: Record<string, string>;
    manualMode?: string;
  };
}

export default function ChatbotScreen() {
  const { theme, isPro, subLoading } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const params = useLocalSearchParams<{ seed?: string }>();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // Assistant is a Pro feature — free users get the paywall.
  useEffect(() => {
    if (!subLoading && !isPro) {
      router.replace("/paywall");
    }
  }, [isPro, subLoading, router]);

  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "bot",
      text:
        "Merhaba! Ben Asistanın. Yediğini, içtiğini veya aktiviteni yaz, takvimine işleyeyim. Sağlık tavsiyesi vermem — yalnızca kayıt.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  // Photo attach state (replaces mic)
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoConfirm, setPhotoConfirm] = useState<{
    preview: string;
    b64: string;
    aiTitle: string;
    aiCalories: number;
  } | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const seedHandledRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await ImagePicker.requestCameraPermissionsAsync();
      } catch {}
    })();
  }, []);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const callChatbot = useCallback(
    async (body: string, draft?: any, answers?: { id: string; answer: string }[]) => {
      try {
        return await api.chatbot(body, istanbulNowISO(), draft, answers);
      } catch (e: any) {
        return { ok: false, error: e?.message || "Bağlantı hatası" };
      }
    }, []);

  const send = useCallback(
    async (overrideText?: string) => {
      const body = (overrideText ?? text).trim();
      if (!body || sending) return;
      setMsgs((m) => [...m, { role: "user", text: body }]);
      setText("");
      setSending(true);
      const res = await callChatbot(body);
      if (res?.needs_clarification) {
        setMsgs((m) => [...m, {
          role: "bot",
          text: res.system_summary || "Birkaç şey sormam lazım:",
          clarification: {
            questions: res.questions || [],
            draft: res.draft || {},
            originalMessage: body,
            answered: {},
          },
        }]);
      } else if (res?.is_health_question) {
        setMsgs((m) => [...m, {
          role: "bot",
          text: res.reply || "Sağlık durumuna özel öneri için diyetisyen görüşmesi gerekir. Ben yemek, aktivite ve su kaydı için buradayım.",
        }]);
      } else if (res?.ok && res?.entry) {
        setMsgs((m) => [...m, { role: "bot", text: res.summary || "Kayıt eklendi.", entry: res.entry, showCta: true }]);
      } else {
        setMsgs((m) => [...m, {
          role: "bot",
          text: res?.error ? "Bir hata oluştu: " + res.error : "Mesajını anlayamadım, biraz daha açar mısın?",
        }]);
      }
      setSending(false);
      scrollDown();
    }, [text, sending, callChatbot]);

  // Seed message from route param (e.g. from Dashboard "1 bardak su" button)
  useEffect(() => {
    const s2 = params?.seed;
    if (s2 && !seedHandledRef.current) {
      seedHandledRef.current = true;
      const seed = Array.isArray(s2) ? s2[0] : s2;
      if (seed && seed.trim()) {
        setTimeout(() => send(seed), 100);
      }
    }
  }, [params, send]);

  const submitAnswers = useCallback(
    async (msgIndex: number, updated: Msg) => {
      const c = updated.clarification!;
      const allAnswered = c.questions.every((q) => !!c.answered[q.id]);
      if (!allAnswered) return;
      setSending(true);
      const answersArr = c.questions.map((q) => ({ id: q.id, answer: c.answered[q.id] }));
      const echo = c.questions.map((q) => `${q.question} → ${c.answered[q.id]}`).join("\n");
      setMsgs((m) => [...m, { role: "user", text: echo }]);
      const res = await callChatbot(c.originalMessage, c.draft, answersArr);
      if (res?.ok && res?.entry) {
        setMsgs((m) => [...m, { role: "bot", text: res.summary || "Kayıt eklendi.", entry: res.entry, showCta: true }]);
      } else if (res?.needs_clarification) {
        setMsgs((m) => [...m, {
          role: "bot",
          text: res.system_summary || "Birkaç şey daha sormam lazım:",
          clarification: {
            questions: res.questions || [],
            draft: res.draft || {},
            originalMessage: c.originalMessage,
            answered: {},
          },
        }]);
      } else {
        setMsgs((m) => [...m, { role: "bot", text: "Kaydı oluştururken bir sorun oldu, tekrar dener misin?" }]);
      }
      setSending(false);
      scrollDown();
    }, [callChatbot]);

  const answerOption = useCallback(
    (msgIndex: number, question: Question, option: string) => {
      if (option === "Manuel gir") {
        setMsgs((m) => {
          const copy = [...m];
          const item = { ...copy[msgIndex] };
          if (!item.clarification) return m;
          item.clarification = { ...item.clarification, manualMode: question.id };
          copy[msgIndex] = item;
          return copy;
        });
        return;
      }
      setMsgs((m) => {
        const copy = [...m];
        const item = { ...copy[msgIndex] };
        if (!item.clarification) return m;
        item.clarification = {
          ...item.clarification,
          answered: { ...item.clarification.answered, [question.id]: option },
          manualMode: undefined,
        };
        copy[msgIndex] = item;
        setTimeout(() => submitAnswers(msgIndex, item), 60);
        return copy;
      });
    }, [submitAnswers]);

  const submitManual = useCallback((msgIndex: number, questionId: string, value: string) => {
    if (!value.trim()) return;
    setMsgs((m) => {
      const copy = [...m];
      const item = { ...copy[msgIndex] };
      if (!item.clarification) return m;
      item.clarification = {
        ...item.clarification,
        answered: { ...item.clarification.answered, [questionId]: value.trim() },
        manualMode: undefined,
      };
      copy[msgIndex] = item;
      setTimeout(() => submitAnswers(msgIndex, item), 60);
      return copy;
    });
  }, [submitAnswers]);

  // ---- Photo attach flow (replaces mic) ----
  const pickPhoto = async (source: "camera" | "library") => {
    setPhotoBusy(true);
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.75,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets?.[0]?.base64) { setPhotoBusy(false); return; }
      const asset = res.assets[0];
      const b64 = asset.base64!;
      // Send to backend photo-analyze
      const analysis = await api.photoAnalyze(b64, "image/jpeg");
      const aiTitle = analysis?.entry?.title || analysis?.title || "Fotoğrafta yemek";
      const aiCalories = Math.round(((analysis?.entry?.calories_min || 0) + (analysis?.entry?.calories_max || 0)) / 2);
      setPhotoConfirm({
        preview: `data:image/jpeg;base64,${b64}`,
        b64,
        aiTitle,
        aiCalories,
      });
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "bot", text: "Fotoğraf işlenemedi: " + (e?.message || "") }]);
    }
    setPhotoBusy(false);
  };

  // Saves the AI's analysis; user can bypass by tapping "Manuel düzelt" which
  // routes them to a normal chat prompt with the AI's title as seed.
  const confirmPhoto = useCallback(
    async (mode: "accept" | "manual") => {
      if (!photoConfirm) return;
      const seed = mode === "accept"
        ? `${photoConfirm.aiTitle}, orta porsiyon, ~${photoConfirm.aiCalories} kcal`
        : `${photoConfirm.aiTitle} — miktarını ben yazacağım`;
      setMsgs((m) => [...m, { role: "user", text: `📷 ${photoConfirm.aiTitle}` }]);
      setPhotoConfirm(null);
      await send(seed);
    }, [photoConfirm]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={[s.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Asistanım</Text>
        <Text style={s.subtitle}>Sadece kayıt — tavsiye yok.</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll}>
          {msgs.map((m, i) => (
            <View key={i} style={[s.msg, m.role === "user" ? s.msgUser : s.msgBot]}>
              <Text style={[s.msgText, m.role === "user" && { color: t.textInverse }]}>{m.text}</Text>

              {/* Saved entry summary */}
              {m.entry && (
                <View style={[s.entryCard, { backgroundColor: t.accentBrand + "22" }]}>
                  <Text style={[s.entryTitle, { color: t.accentBrand }]}>{m.entry.title}</Text>
                  <Text style={[s.entryMeta, { color: t.accentBrand }]}>{m.entry.date} • {m.entry.time}</Text>
                  {m.entry.calories_min != null && (
                    <Text style={[s.entryMeta, { color: t.accentBrand }]}>
                      {Math.round(((m.entry.calories_min || 0) + (m.entry.calories_max || 0)) / 2)} kcal
                    </Text>
                  )}
                </View>
              )}

              {/* Confirmation CTAs — only after a successful save */}
              {m.showCta && m.entry && (
                <View style={s.ctaRow}>
                  <TouchableOpacity
                    testID={`msg-${i}-cta-calendar`}
                    onPress={() =>
                      router.push({
                        pathname: "/day/[date]",
                        params: { date: m.entry.date, highlight: m.entry.id, t: `${m.entry.time || ""}` },
                      })
                    }
                    style={[s.ctaBtn, { backgroundColor: t.accentBrand }]}
                  >
                    <Ionicons name="calendar" size={16} color={t.textInverse} />
                    <Text style={[s.ctaBtnText, { color: t.textInverse }]}>Takvime git</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`msg-${i}-cta-more`}
                    onPress={() => inputRef.current?.focus()}
                    style={[s.ctaBtnOutline, { borderColor: t.accentBrand }]}
                  >
                    <Ionicons name="add" size={16} color={t.accentBrand} />
                    <Text style={[s.ctaBtnText, { color: t.accentBrand }]}>Başka kayıt ekle</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Clarification questions */}
              {m.clarification && (
                <View style={s.clarifyWrap}>
                  {m.clarification.questions.map((q) => {
                    const chosen = m.clarification!.answered[q.id];
                    const isManualMode = m.clarification!.manualMode === q.id;
                    return (
                      <View key={q.id} style={s.clarifyQ}>
                        <Text style={s.clarifyQText}>{q.question}</Text>
                        {isManualMode ? (
                          <ManualEntry
                            testID={`clarify-manual-${q.id}`}
                            placeholder="Sayı veya kısa açıklama yaz…"
                            onSubmit={(v) => submitManual(i, q.id, v)}
                            onCancel={() => setMsgs((old) => {
                              const copy = [...old];
                              const item = { ...copy[i] };
                              if (!item.clarification) return old;
                              item.clarification = { ...item.clarification, manualMode: undefined };
                              copy[i] = item;
                              return copy;
                            })}
                            theme={t}
                          />
                        ) : (
                          <View style={s.clarifyOpts}>
                            {q.options.map((opt) => {
                              const sel = chosen === opt;
                              return (
                                <TouchableOpacity
                                  key={opt}
                                  testID={`clarify-${q.id}-${opt}`}
                                  disabled={!!chosen || sending}
                                  onPress={() => answerOption(i, q, opt)}
                                  style={[s.clarifyOpt, sel && s.clarifyOptSel]}
                                >
                                  <Text style={[s.clarifyOptText, sel && s.clarifyOptTextSel]}>{opt}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
          {(sending || photoBusy) && (
            <View style={[s.msg, s.msgBot]}>
              <ActivityIndicator color={t.accentBrand} />
            </View>
          )}
        </ScrollView>

        {/* Photo confirmation modal */}
        <Modal visible={!!photoConfirm} transparent animationType="fade" onRequestClose={() => setPhotoConfirm(null)}>
          <Pressable style={s.photoBackdrop} onPress={() => setPhotoConfirm(null)}>
            <Pressable style={s.photoCard} onPress={(e) => e.stopPropagation()}>
              {photoConfirm && (
                <>
                  <Image source={{ uri: photoConfirm.preview }} style={s.photoPreview} />
                  <Text style={s.photoTitle}>{photoConfirm.aiTitle}</Text>
                  {photoConfirm.aiCalories > 0 && (
                    <Text style={s.photoSub}>~{photoConfirm.aiCalories} kcal</Text>
                  )}
                  <Text style={s.photoQuestion}>Bu doğru mu? Ayarlama yapmak ister misin?</Text>
                  <View style={s.photoActions}>
                    <TouchableOpacity
                      testID="photo-confirm-manual"
                      style={[s.photoBtn, { backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border }]}
                      onPress={() => confirmPhoto("manual")}
                    >
                      <Text style={[s.photoBtnText, { color: t.textMain }]}>Manuel düzelt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="photo-confirm-accept"
                      style={[s.photoBtn, { backgroundColor: t.accentBrand }]}
                      onPress={() => confirmPhoto("accept")}
                    >
                      <Text style={[s.photoBtnText, { color: t.textInverse }]}>Evet, kaydet</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Highlighted reminder banner — right above the input area */}
        <View style={s.activityBanner} testID="chat-activity-banner">
          <View style={s.activityBannerIcon}>
            <Ionicons name="barbell" size={14} color="#0A0F0D" />
          </View>
          <Text style={s.activityBannerText}>Aktiviteni eklemeyi unutma!</Text>
        </View>

        {/* Manuel giriş — yemek adı + makro gramları, kalori otomatik */}
        <View style={s.shortcutsWrap}>
          <TouchableOpacity
            testID="chat-manual-entry-btn"
            style={[s.manualBtn, { borderColor: t.accentBrand, backgroundColor: t.surface }]}
            onPress={() => setManualOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={16} color={t.accentBrand} />
            <Text style={[s.manualBtnText, { color: t.accentBrand }]}>Manuel Gir</Text>
          </TouchableOpacity>
        </View>

        <ManualFoodModal
          visible={manualOpen}
          theme={t}
          onClose={() => setManualOpen(false)}
          onSaved={(entry) => {
            setManualOpen(false);
            setMsgs((m) => [...m, { role: "bot", text: "Manuel kaydını takvimine ekledim.", entry, showCta: true }]);
            scrollDown();
          }}
        />

        <View style={s.inputBar}>
          <TouchableOpacity
            testID="chat-photo-btn"
            onPress={() => {
              // Ask user: camera vs library.
              if (Platform.OS === "web") { pickPhoto("library"); return; }
              // simple confirm on native
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Alert } = require("react-native");
                Alert.alert("Fotoğraf", "Kaynağı seç:", [
                  { text: "Kamera", onPress: () => pickPhoto("camera") },
                  { text: "Galeri", onPress: () => pickPhoto("library") },
                  { text: "Vazgeç", style: "cancel" },
                ]);
              } catch { pickPhoto("library"); }
            }}
            style={[s.iconBtn, { backgroundColor: t.surfaceAlt }]}
            disabled={photoBusy}
          >
            <Ionicons name="camera-outline" size={22} color={t.textMain} />
          </TouchableOpacity>
          <TextInput
            testID="chat-input"
            ref={inputRef}
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Kayıt eklemek için yaz…"
            placeholderTextColor={t.textMuted}
            onSubmitEditing={() => send()}
            blurOnSubmit={false}
            multiline
          />
          <TouchableOpacity
            testID="chat-send-btn"
            onPress={() => send()}
            style={[s.iconBtn, { backgroundColor: t.accentBrand }]}
            disabled={sending || !text.trim()}
          >
            <Ionicons name="arrow-up" size={22} color={t.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ManualEntry: React.FC<{ testID: string; placeholder: string; onSubmit: (v: string) => void; onCancel: () => void; theme: any }> = ({ testID, placeholder, onSubmit, onCancel, theme }) => {
  const [v, setV] = useState("");
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 }}>
      <TextInput
        testID={testID}
        style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: theme.border, color: theme.textMain, fontSize: 13 }}
        value={v}
        onChangeText={setV}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoFocus
      />
      <TouchableOpacity onPress={() => onSubmit(v)} style={{ backgroundColor: theme.accentBrand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
        <Ionicons name="checkmark" size={16} color={theme.textInverse} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
        <Ionicons name="close" size={16} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  title: { fontSize: 22, fontWeight: "800", color: t.textMain },
  subtitle: { color: t.textMuted, marginTop: 2, fontSize: 13 },
  scroll: { padding: SPACING.lg, gap: 10, paddingBottom: 12 },
  msg: { padding: 14, borderRadius: RADIUS.lg, maxWidth: "88%" },
  msgUser: { backgroundColor: t.accentBrand, alignSelf: "flex-end", borderTopRightRadius: 4 },
  msgBot: { backgroundColor: t.surface, alignSelf: "flex-start", borderTopLeftRadius: 4, borderWidth: 1, borderColor: t.border },
  msgText: { color: t.textMain, fontSize: 14, lineHeight: 22 },
  entryCard: { marginTop: 8, padding: 10, borderRadius: RADIUS.md },
  entryTitle: { fontWeight: "800", fontSize: 13 },
  entryMeta: { fontSize: 12, marginTop: 2 },

  // Confirmation CTAs after successful save
  ctaRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, flex: 1, justifyContent: "center" },
  ctaBtnOutline: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, flex: 1, justifyContent: "center" },
  ctaBtnText: { fontSize: 12, fontWeight: "800" },

  clarifyWrap: { marginTop: 10, gap: 10 },
  clarifyQ: {
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
  },
  clarifyQText: { fontSize: 13, color: t.textMain, fontWeight: "700", marginBottom: 6 },
  clarifyOpts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  clarifyOpt: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.border,
  },
  clarifyOptSel: { backgroundColor: t.accentBrand, borderColor: t.accentBrand },
  clarifyOptText: { fontSize: 12, color: t.textMain, fontWeight: "700" },
  clarifyOptTextSel: { color: t.textInverse },

  shortcutsWrap: { paddingVertical: 8, paddingHorizontal: SPACING.lg },
  activityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#FFD54F",
    borderWidth: 1.5,
    borderColor: "#F0B429",
  },
  activityBannerIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  activityBannerText: { flex: 1, fontSize: 12.5, fontWeight: "900", color: "#0A0F0D", letterSpacing: 0.2 },
  manualBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5 },
  manualBtnText: { fontSize: 13, fontWeight: "800" },

  inputBar: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: SPACING.lg, paddingVertical: 10,
    alignItems: "flex-end",
    backgroundColor: t.bg,
    borderTopWidth: 1, borderTopColor: t.border,
  },
  input: {
    flex: 1, backgroundColor: t.surface, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: t.textMain,
    borderWidth: 1, borderColor: t.border, maxHeight: 100,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center" },

  // Photo confirmation modal
  photoBackdrop: { flex: 1, backgroundColor: "rgba(11,38,32,0.55)", justifyContent: "center", padding: 20 },
  photoCard: { backgroundColor: t.surface, borderRadius: RADIUS.xl, padding: 18, borderWidth: 1, borderColor: t.border },
  photoPreview: { width: "100%", height: 220, borderRadius: RADIUS.lg, backgroundColor: t.surfaceAlt },
  photoTitle: { fontSize: 17, fontWeight: "800", color: t.textMain, marginTop: 14 },
  photoSub: { fontSize: 12, color: t.textMuted, fontWeight: "600", marginTop: 3 },
  photoQuestion: { fontSize: 13, color: t.textMain, marginTop: 12, lineHeight: 19 },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  photoBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  photoBtnText: { fontWeight: "800", fontSize: 13 },
});
