import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

// ── Configuração ──────────────────────────────────────────────
// Altere para o seu repositório GitHub: "usuario/repo"
const GITHUB_REPO = 'NaoEhOMauricio/FichaX';
// ─────────────────────────────────────────────────────────────

const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Compara versões semver. Retorna true se `remote` é mais recente que `local`. */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPatch] = parse(local);
  const [rMaj, rMin, rPatch] = parse(remote);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPatch > lPatch;
}

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;

    const release = await res.json();
    const latestTag: string = release.tag_name ?? '';
    if (!latestTag) return;

    const currentVersion: string = Constants.expoConfig?.version ?? '0.0.0';
    if (!isNewer(currentVersion, latestTag)) return;

    // Procura o APK nos assets da release
    const apkAsset = (release.assets ?? []).find(
      (a: { name: string }) => a.name.endsWith('.apk')
    );
    const downloadUrl: string = apkAsset?.browser_download_url ?? release.html_url;

    Alert.alert(
      'Atualização disponível',
      `Versão ${latestTag} disponível (atual: v${currentVersion}).\n\nDeseja baixar agora?`,
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Baixar', onPress: () => Linking.openURL(downloadUrl) },
      ]
    );
  } catch {
    // Falha silenciosa — não interrompe o uso do app
  }
}

/** Hook: verifica atualização uma vez por sessão ao montar o componente. */
export function useUpdateCheck(): void {
  useEffect(() => {
    checkForUpdate();
  }, []);
}
