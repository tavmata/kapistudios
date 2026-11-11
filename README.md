# Kapi Studios

Site oficial do **Kapi Studios** — estúdio independente de desenvolvimento de jogos focado em experiências encantadoras, natureza e magia.

- **GitHub Pages:** [https://tavmata.github.io/kapistudios/](https://tavmata.github.io/kapistudios/)
- **MMORPG:** [https://mmorpg.kich.dev.br](https://mmorpg.kich.dev.br)
- **Portal:** [https://kich.dev.br](https://kich.dev.br)

---

## Estrutura do Projeto

```text
kapistudios/
├── assets/
│   ├── developer-logo-*.svg    # Variações e marcas de estúdio
│   ├── game/                   # Captura real da Ilha de Areia (WebP)
│   ├── js/                     # Renderizadores procedurais em Canvas (monstros e personagens)
│   ├── kapi-mark.svg           # Marca da capivara
│   ├── kapi-studios-logo.svg   # Logotipo completo
│   ├── mmorpg/                 # Imagens do jogo usadas nas páginas geradas
│   ├── site.css                # Estilo das páginas geradas (guia do jogo e blog)
│   └── mmorpg-preview.mp4      # Vídeo de demonstração do 2D MMORPG
│   └── video/                  # Fundos de gameplay que tocam ao rolar (bg-<clipe>-land/port.mp4 + pôster .webp)
├── index.html                  # Página principal (HTML semântico e acessível)
├── style.css                   # Folha de estilos (design responsivo, paleta natural)
├── main.js                     # Efeitos visuais, vaga-lumes e interatividade
├── nginx.conf                  # Configuração opcional para proxy reverso / servidor próprio
└── .nojekyll                   # Garante serviço estático direto no GitHub Pages
```

---

## Páginas geradas (guia do jogo e blog)

As pastas `mmorpg/` e `blog/`, o `sitemap.xml` e o `robots.txt` são **gerados**, não escritos à mão. Não edite esses arquivos: rode o gerador.

```bash
node tools/build-studio-site.js          # escreve os arquivos
node tools/build-studio-site.js --check  # falha se estiverem desatualizados
```

- `/mmorpg/` é a página do jogo; `/mmorpg/classes/`, `/mmorpg/forja/` e `/mmorpg/drops/` leem os dados do próprio jogo (árvore de habilidades, regras de refino, drops), e `/mmorpg/melhores-mmorpgs-de-navegador/` vem de `server/seo/browserGames.js`.
- O blog vem dos arquivos Markdown em `server/content/blog/` (veja o cabeçalho de `server/seo/blog.js`). Para um post novo, crie o `.md`, rode o gerador e publique.
- O visual está em `assets/site.css` e as imagens do jogo em `assets/mmorpg/`.
- O `deploy.ps1` roda o gerador antes de empacotar, e um teste (`publicSite.test.js`) falha se os arquivos commitados estiverem desatualizados.
- As páginas antigas em `mmorpg.kich.dev.br/classes`, `/forja`, `/drops`, `/descobrir` e `/blog` redirecionam (301) para cá.

## Visualização Local

Você pode abrir o arquivo `index.html` diretamente em qualquer navegador moderno ou rodar um servidor HTTP local:

```bash
# Com Python 3
python -m http.server 8000

# Ou com Node.js (npx)
npx serve .
```

Acesse em: `http://localhost:8000`

---

## Vídeos de fundo

Os trechos escuros da página (manifesto, índice, bestiário, trilhas e rodapé) têm gameplay em tela cheia por trás do texto. Cada vídeo só carrega quando a seção chega perto, toca enquanto está na tela e pausa quando sai; telas em pé recebem a versão retrato. Com movimento reduzido ou economia de dados, fica só o pôster.

Os clipes saem das gravações limpas (sem legenda) em `marketing/crazygames/video/public/clips/`, em 1280x720 e 720x1080, sem áudio, com o fim fundido ao começo para o loop não pular. Como `*.mp4` é ignorado pelo git, os `.mp4` de `assets/video/` só existem no disco e vão para o servidor pelo `deploy.ps1`; os pôsteres `.webp` são versionados.

## Hospedagem no GitHub Pages

Este repositório foi estruturado para ser servido diretamente pelo **GitHub Pages**:
- Os caminhos de arquivos (`assets/`, `style.css`, `main.js`) são relativos, funcionando perfeitamente em subdiretórios (`https://tavmata.github.io/kapistudios/`) ou em domínios personalizados (`CNAME`).

## Publicação no domínio próprio

A versão aprovada no Figma foi importada de `E:\kapicode` para esta pasta. O site público é https://kapistudios.kich.dev.br/ (com **s**).

No projeto `2mmorpgexport`, `deploy.ps1` inclui `kapistudios/` no pacote e copia os arquivos para `/var/www/kapistudios` no servidor Oracle. Esse comando também atualiza e reinicia o MMORPG; para publicar somente a página, envie apenas `index.html`, `main.js`, `style.css` e `assets/` para essa pasta do servidor. Preserve permissões de leitura web: diretórios 755 e arquivos 644. Faça backup antes de substituir uma versão.

Os GitHub Actions atuais não publicam esse domínio: `sync-satellites.yml` sincroniza o repositório `tavmata/kapistudios`, e `main_2mmorpg-crude.yml` publica uma aplicação no Azure. Um push isolado não equivale à publicação no servidor Oracle.

O HTML desta publicação usa identificadores de conteúdo nas URLs de `style.css` e `main.js` para evitar o cache de sete dias da versão anterior. Ao atualizar esses arquivos no futuro, atualize também suas versões no HTML.

Origem visual: https://www.figma.com/design/Wz7BVZUoUiZyv2s5Gm6thD/Kapi?node-id=0-1&code-node-id=1-3
