# Gerar o APK com GitHub Actions

O Gradle travava no Termux (`aapt2` binário x86 só). O workflow
`.github/workflows/android.yml` compila o APK numa máquina ubuntu e publica o
artefato `sagaz-debug-apk`.

## Passos

```bash
# dentro de ~/projetos/sagaz (git já inicializado, 3 commits)
gh repo create sagaz --public --source=. --push          # opcional: gh CLI já logado
# ou manualmente:
git remote add origin git@github.com:SEU_USUARIO/sagaz.git
git push -u origin main
```

A action roda sozinha: `tests (78) → web build → cap sync → gradlew assembleDebug`.

## Baixar o APK

1. GitHub → repositório → aba **Actions**
2. Clique no job **Android APK**
3. Em Artifacts: **sagaz-debug-apk** (contém `app-debug.apk`)
4. Instalar no Android (habilitar "fontes desconhecidas")

## Releases

Para APK de versão formal, rode `npx cap sync android`, no Actions dispare
`workflow_dispatch` e troque `assembleDebug` por `assembleRelease` + assinatura
(o keystore NUNCA sobe ao repositório — use um secret `ANDROID_KEYSTORE_BASE64`).

## Configurar a IA

- No app: **Configurações → IA** (chave fica só no aparelho)
- Em build: variáveis `VITE_AI_BASE_URL`, `VITE_AI_API_KEY`, `VITE_AI_MODEL`
  no workflow (secrets do GitHub) — antes do `npm run build`. Sempre for
  segredo, use `secrets.*`, nunca literal no yaml.
