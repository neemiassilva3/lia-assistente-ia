# lia-assistente-ia
Lia, uma assistente virtual full-stack (Python/Flask, JS). 🤖 Utiliza a API Google Gemini com contexto dinâmico de PDF (RAG). Apresenta um avatar de vídeo interativo, interface de nuvem de resposta, TTS/STT e sistema de gamificação. 

## Principais Funcionalidades

Este projeto foi além de um chatbot padrão, focando em uma experiência de usuário (UX) rica e em funcionalidades de engajamento:

* **Contexto Dinâmico (RAG):** O back-end lê e processa um PDF (`guia_exemplo.pdf`) usando `PyPDF2` e `scikit-learn` (TF-IDF / Similaridade de Cosseno). Os trechos mais relevantes são enviados como contexto para a IA (Gemini), garantindo respostas precisas e baseadas no documento.
* **Avatar com Vídeo Dinâmico:** A interface da Lia não é estática; ela usa dois vídeos (`lia_idle.mp4` e `lia_speaking.mp4`) para alternar visualmente entre os estados de "parada" e "falando".
* **Voz (TTS & STT):** Integra a Web Speech API do navegador para funcionalidade completa de Text-to-Speech (Voz da Lia) e Speech-to-Text (Reconhecimento de Voz do usuário).
* **Interface Inovadora (Nuvem & Pílulas):** Abandona o histórico de chat tradicional em favor de uma "nuvem de resposta" única e "pílulas" de histórico que mostram as últimas perguntas feitas, com quebra de linha em telas mobile.
* **Lógica de "Continuar":** O back-end detecta respostas longas da IA, as divide, e envia um prompt de "Continuar", permitindo ao usuário ler respostas extensas em partes sem quebrar o layout.
* **Gamificação & Login:** Inclui um sistema de login VIP (baseado em CSV) e um sistema de pontos (armazenado em JSON) para engajamento.
* **Funcionalidade de Câmera:** Permite que usuários VIP tirem uma foto e a recebam por e-mail (integrado com a API do SendGrid).

## 🛠️ Stack Tecnológica

### Back-end
* **Python 3**
* **Flask:** Servidor web e API REST.
* **Google Generative AI (`google-generativeai`):** Acesso ao modelo Gemini 1.5 Flash.
* **Scikit-learn (`sklearn`):** Vetorização TF-IDF e Similaridade de Cosseno para a busca no PDF.
* **PyPDF2:** Extração de texto do documento guia.
* **SendGrid:** Envio de e-mails com a foto.
* **Dotenv:** Gerenciamento de chaves de API.

### Front-end
* **HTML5**
* **CSS3 (Customizado):** Design responsivo "Mobile-First", animações (`@keyframes`) e Flexbox.
* **JavaScript (Vanilla JS):** Lógica de UI, controle de estado, chamadas `fetch` para a API.
* **Web Speech API:** Para `SpeechSynthesis` (TTS) e `SpeechRecognition` (STT).

## 🚀 Como Executar Localmente

Siga estes passos para rodar o projeto na sua máquina.

### 1. Configuração do Back-end

1.  Clone este repositório:
    ```bash
    git clone [https://github.com/](https://github.com/)[SEU-NOME-DE-USUARIO]/lia-assistente-ia.git
    cd lia-assistente-ia
    ```
2.  Crie e ative um ambiente virtual:
    ```bash
    python -m venv venv
    source venv/bin/activate  # macOS/Linux
    .\venv\Scripts\activate   # Windows
    ```
3.  Instale as dependências:
    ```bash
    pip install -r requirements.txt
    ```
4.  Crie um arquivo `.env` na raiz do projeto e adicione suas chaves:
    ```
    GOOGLE_API_KEY="SUA_CHAVE_DO_GEMINI_AQUI"
    SENDGRID_API_KEY="SUA_CHAVE_DO_SENDGRID_AQUI"
    SENDER_EMAIL="seu_email_verificado@sendgrid.com"
    ```
5.  **Arquivos de Dados:** Este repositório usa arquivos de exemplo anonimizados (`guia_exemplo.pdf`, `cadastro_exemplo.csv`). O código já está configurado para usá-los.

6.  Execute o servidor Flask:
    ```bash
    python Lia.py
    ```

### 2. Acesso ao Front-end

1.  O servidor Flask já está servindo o front-end.
2.  Abra seu navegador e acesse: `http://127.0.0.1:5000`

## 🔒 Segurança e Privacidade

Para este portfólio, todos os dados sensíveis foram tratados:
* As chaves de API são carregadas via `.env` e este arquivo está bloqueado pelo `.gitignore`.
* Os arquivos `guia_metaday.pdf` e `cadastro.csv` originais (contendo nomes reais) foram substituídos por versões de exemplo (`guia_exemplo.pdf`, `cadastro_exemplo.csv`) com dados fictícios.
* Os arquivos de dados reais estão listados no `.gitignore` para prevenir uploads acidentais.

## 👤 Autoria

**Neemias Silva**

---
*Projeto desenvolvido no contexto acadêmico da Fatec Sebrae.*
