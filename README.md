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
│   ├── kapi-mark.svg           # Marca da capivara
│   ├── kapi-studios-logo.svg   # Logotipo completo
│   └── mmorpg-preview.mp4      # Vídeo de demonstração do 2D MMORPG
├── index.html                  # Página principal (HTML semântico e acessível)
├── style.css                   # Folha de estilos (design responsivo, paleta natural)
├── main.js                     # Efeitos visuais, vaga-lumes e interatividade
├── nginx.conf                  # Configuração opcional para proxy reverso / servidor próprio
└── .nojekyll                   # Garante serviço estático direto no GitHub Pages
```

---

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

## Hospedagem no GitHub Pages

Este repositório foi estruturado para ser servido diretamente pelo **GitHub Pages**:
- Os caminhos de arquivos (`assets/`, `style.css`, `main.js`) são relativos, funcionando perfeitamente em subdiretórios (`https://tavmata.github.io/kapistudios/`) ou em domínios personalizados (`CNAME`).
