# Script para Claude.ai: Habilitar atualização automática OTA com Expo EAS Update

1. Instalar o pacote expo-updates:
   ```
   npx expo install expo-updates
   ```

2. Adicionar a configuração do expo-updates no app.json:
   ```json
   {
     "expo": {
       // ...outras configs...
       "updates": {
         "enabled": true,
         "checkAutomatically": "ON_LOAD",
         "fallbackToCacheTimeout": 0
       }
     }
   }
   ```

3. Confirmar que o projeto está usando EAS Build (já está configurado no eas.json).

4. (Opcional) Adicionar workflow GitHub Actions para deploy automático OTA:
   - Criar arquivo `.github/workflows/eas-update.yml` com:
     ```yaml
     name: EAS Update
     on:
       push:
         branches:
           - main
     jobs:
       update:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v3
           - uses: expo/expo-github-action@v8
             with:
               eas-version: latest
               token: ${{ secrets.EXPO_TOKEN }}
           - run: eas update --auto
     ```
   - Adicionar o segredo `EXPO_TOKEN` nas configurações do repositório no GitHub.

5. Fazer um commit e push para a branch main.

6. Testar o update OTA em um build novo do app.

---

Esse roteiro garante que o Claude.ai poderá implementar a atualização automática OTA no seu app Expo assim que for solicitado.