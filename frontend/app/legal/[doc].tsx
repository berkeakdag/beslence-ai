// Legal documents — Gizlilik Politikası & Kullanım Şartları.
// Required by App Store / Google Play for subscription apps (in-app accessible).
import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/auth-context";
import { SPACING, getThemed } from "@/src/theme";

const PRIVACY = `Son güncelleme: Haziran 2026

1. Toplanan Veriler
BESLENCE AI; adınız, e-posta adresiniz (Google ile giriş), yaş/boy/kilo gibi profil bilgileriniz, kaydettiğiniz yemek/aktivite/su verileri ve yüklediğiniz yemek fotoğraflarını işler.

2. Kullanım Amacı
Verileriniz yalnızca kalori/makro hesaplaması, günlük rapor oluşturma ve zaman çizelgesi görünümü için kullanılır. Sağlık tavsiyesi verilmez; uygulama bir kayıt ve hesaplama aracıdır.

3. Yapay Zekâ İşleme
Yazdığınız kayıt metinleri ve yemek fotoğrafları, besin tanıma amacıyla yapay zekâ servislerine iletilir. Bu veriler reklam amaçlı kullanılmaz.

4. Saklama ve Silme
Verileriniz güvenli sunucularda saklanır. Profil sekmesindeki "Hesabı sil" seçeneği ile hesabınızı ve tüm verilerinizi kalıcı olarak silebilirsiniz.

5. Üçüncü Taraflar
Kimlik doğrulama (Google), abonelik yönetimi (RevenueCat / App Store / Google Play) ve bildirim altyapısı için sınırlı veri paylaşımı yapılır. Verileriniz satılmaz.

6. Bildirimler
Günlük rapor ve su hatırlatıcısı bildirimleri gönderilir. Cihaz ayarlarından istediğiniz zaman kapatabilirsiniz.

7. İletişim
Sorularınız için uygulama mağazası sayfasındaki destek kanalını kullanabilirsiniz.`;

const TERMS = `Son güncelleme: Haziran 2026

1. Hizmetin Kapsamı
BESLENCE AI bir beslenme ve aktivite KAYIT aracıdır. Tıbbi ya da diyetetik tavsiye VERMEZ. Tüm veriler bilgilendirme amaçlıdır; sağlık kararlarınız için bir uzmana danışın.

2. Abonelik (BESLENCE AI Pro)
• Ücret: ₺299 / ay, 3 günlük ücretsiz deneme ile başlar.
• Deneme süresi bitmeden en az 24 saat önce iptal edilmezse abonelik otomatik olarak yenilenir ve ücret App Store / Google Play hesabınızdan tahsil edilir.
• Aboneliği istediğiniz zaman App Store veya Google Play abonelik ayarlarından iptal edebilirsiniz; iptal, mevcut fatura döneminin sonunda geçerli olur.
• Ücretsiz sürümde manuel kayıt ekleme kullanılabilir; AI Asistan ve Günlük Rapor, Pro aboneliği gerektirir.

3. Hesap
Hesabınızı Profil sekmesinden dilediğiniz zaman silebilirsiniz. Silme işlemi geri alınamaz.

4. Sorumluluk Reddi
Kalori ve makro değerleri yaklaşık tahminlerdir. Uygulama, verilerin doğruluğu veya sağlık sonuçları konusunda garanti vermez.

5. Kabul
Uygulamayı kullanarak bu şartları kabul etmiş olursunuz. iOS kullanıcıları için Apple'ın standart EULA'sı (apple.com/legal/internet-services/itunes/dev/stdeula) da geçerlidir.`;

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const { theme } = useAuth();
  const t = getThemed(theme);
  const s = useMemo(() => makeStyles(t), [t]);
  const isTerms = doc === "terms";

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity testID="legal-back" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={t.textMain} />
        </TouchableOpacity>
        <Text style={s.title}>{isTerms ? "Kullanım Şartları" : "Gizlilik Politikası"}</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.body}>{isTerms ? TERMS : PRIVACY}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ReturnType<typeof getThemed>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: SPACING.lg, paddingVertical: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  title: { fontSize: 18, fontWeight: "800", color: t.textMain },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  body: { fontSize: 13, lineHeight: 21, color: t.textMain },
});
