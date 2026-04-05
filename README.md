# Pós-graduação PTA — landings estáticas

Monorepo com as páginas (HTML/CSS/JS), scripts de build (`build.js`) e pastas `dist/` prontas para deploy.

## Antes de enviar ao GitHub

1. Confirme que **não existe** `.git` dentro de subpastas (só na raiz `pos_graduacao/`). Um repositório dentro de outro impede o `git push` de incluir os ficheiros.

2. Crie um repositório **vazio** no GitHub (sem README inicial, se for o primeiro push).

3. Na raiz desta pasta:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

Substitua a URL pela sua (HTTPS ou `git@github.com:...` com SSH).

4. Autenticação: no GitHub use um **Personal Access Token** (HTTPS) ou chave **SSH**.

## Regenerar builds

Em cada projeto com `package.json`: `npm install` e `npm run build`.
